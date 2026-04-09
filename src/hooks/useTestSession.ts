"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { QuestionData } from "@/types/question";
import { supabase } from "@/lib/supabase";

interface UseTestSessionProps {
    questions: QuestionData[];
    timeLimit: number;
    onComplete: (results: any) => void;
    examType?: string;
    section?: string;
    generationMode?: 'balanced' | 'fresh' | 'fast';
}

export function useTestSession({
    questions: initialQuestions,
    timeLimit,
    onComplete,
    examType,
    section,
    generationMode = 'balanced'
}: UseTestSessionProps) {
    const [questions, setQuestions] = useState<QuestionData[]>(initialQuestions);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [timeLeft, setTimeLeft] = useState(timeLimit);
    const [taskTimeLeft, setTaskTimeLeft] = useState<number | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [pendingSpeakingQuestionId, setPendingSpeakingQuestionId] = useState<string | null>(null);

    const [currentModule, setCurrentModule] = useState<1 | 2>(1);
    const [module1Locked, setModule1Locked] = useState(false);
    const [isLoadingModule2, setIsLoadingModule2] = useState(false);
    const [module2Loaded, setModule2Loaded] = useState(false);

    // ─────────────────────────────────────────────────────────────────────────
    // Stable refs — let closures inside intervals read current values WITHOUT
    // those values appearing in effect dependency arrays (which would cause
    // the interval to tear down and restart on every tick / answer / nav).
    // ─────────────────────────────────────────────────────────────────────────
    const onCompleteRef = useRef(onComplete);
    const answersRef    = useRef(answers);
    const currentIndexRef = useRef(currentIndex);
    const questionsRef  = useRef(questions);

    // Keep refs in sync every render (no deps needed — runs after every render)
    useEffect(() => { onCompleteRef.current = onComplete; });
    useEffect(() => { answersRef.current = answers; });
    useEffect(() => { currentIndexRef.current = currentIndex; });
    useEffect(() => { questionsRef.current = questions; });

    // ─────────────────────────────────────────────────────────────────────────
    // Anchor refs for drift-resistant timing.
    // Instead of decrementing a counter each tick (which accumulates ±1 s
    // error per restart), we record the wall-clock start + snapshot value and
    // subtract elapsed real time on every tick.
    // ─────────────────────────────────────────────────────────────────────────
    const globalAnchorRef = useRef<{ time: number; remaining: number } | null>(null);
    const taskAnchorRef   = useRef<{ time: number; remaining: number } | null>(null);

    // ─────────────────────────────────────────────────────────────────────────
    // Derived state (not stored in state to avoid extra re-renders)
    // ─────────────────────────────────────────────────────────────────────────
    const isAdaptiveSection = questions.some(q => q.metadata?.module === 1);
    const module1Questions  = questions.filter(q => q.metadata?.module === 1);
    const module1EndIndex   = module1Questions.length - 1;
    const isListeningSection = (section || "").toLowerCase() === "listening";

    // ─────────────────────────────────────────────────────────────────────────
    // Per-task time limits — aligned with TOEFL iBT New Format spec (2026):
    //   Speaking / Listen and Repeat  : 12 s per sentence (spec: 8–12 s)
    //   Speaking / Take an Interview  : 45 s per question
    //   Writing  / Build a Sentence   : 60 s per sentence (not timed in spec but
    //                                   provides pacing; full section is ~23 min)
    //   Writing  / Write an Email     : 7 min (spec: 7 minutes)
    //   Writing  / Academic Discussion: 10 min (spec: 10 minutes)
    //   Reading / Listening tasks     : no per-item timer — section clock runs
    // ─────────────────────────────────────────────────────────────────────────
    const getTaskTimeLimit = useCallback((q: QuestionData): number | null => {
        const taskType = (q.taskType || "").toLowerCase();
        const sec = (q.section || section || "").toLowerCase();

        if (sec === "speaking") {
            if (taskType.includes("interview")) return 45;        // spec: 45 s
            if (taskType.includes("repeat"))    return 12;        // spec: 8–12 s
            return 30;
        }

        if (sec === "writing") {
            if (taskType.includes("build"))       return 60;      // ~1 min per sentence
            if (taskType.includes("email"))       return 7 * 60;  // spec: 7 min
            if (taskType.includes("discussion"))  return 10 * 60; // spec: 10 min
        }

        return null; // Reading & Listening run on the shared section clock
    }, [section]);

    // ─────────────────────────────────────────────────────────────────────────
    // Effect 1: Reset per-task timer when the question changes.
    // Also resets the task anchor so the drift-correction starts fresh.
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const q = questions[currentIndex];
        if (!q) return;
        const limit = getTaskTimeLimit(q);
        setTaskTimeLeft(limit);
        if (limit !== null) {
            taskAnchorRef.current = { time: Date.now(), remaining: limit };
        } else {
            taskAnchorRef.current = null;
        }
    }, [currentIndex, questions, getTaskTimeLimit]);

    // ─────────────────────────────────────────────────────────────────────────
    // Effect 2: Reset global anchor whenever the timer activates/resumes.
    // Captures a snapshot of timeLeft at that moment so we count from there.
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (isActive && !isLoadingModule2) {
            globalAnchorRef.current = { time: Date.now(), remaining: timeLeft };
        } else {
            globalAnchorRef.current = null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive, isLoadingModule2]);

    // ─────────────────────────────────────────────────────────────────────────
    // Effect 3: Single stable countdown interval.
    //
    // Key design:
    //  - Deps: ONLY [isActive, isLoadingModule2, section].
    //    No timeLeft / taskTimeLeft / answers / currentIndex / questions.
    //    Those are read via refs or anchor refs, so the interval NEVER restarts
    //    mid-countdown — eliminating the "pause between questions" symptom.
    //
    //  - Ticks at 250 ms for smooth display; drift-free because value =
    //    anchor_snapshot − elapsed_real_seconds.
    //
    //  - Priority: per-task timer (taskAnchorRef) wins over global (globalAnchorRef).
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isActive || isLoadingModule2) return;

        const intervalId = setInterval(() => {
            const now = Date.now();

            if (taskAnchorRef.current !== null) {
                // ── Per-task countdown ──────────────────────────────────────
                const elapsed = (now - taskAnchorRef.current.time) / 1000;
                const newVal  = Math.max(0, Math.round(taskAnchorRef.current.remaining - elapsed));
                setTaskTimeLeft(newVal);

                if (newVal <= 0) {
                    taskAnchorRef.current = null; // disarm so we don't fire twice

                    const idx              = currentIndexRef.current;
                    const qs               = questionsRef.current;
                    const activeQuestion   = qs[idx];
                    const activeSection    = (activeQuestion?.section || section || "").toLowerCase();

                    if (activeSection === "speaking" && activeQuestion?.id) {
                        // Speaking: pause and wait for the recorder to submit
                        setIsActive(false);
                        setPendingSpeakingQuestionId(activeQuestion.id);
                    } else {
                        // All other per-task sections: auto-advance
                        setCurrentIndex((i) => {
                            if (i < qs.length - 1) return i + 1;
                            setIsCompleted(true);
                            setIsActive(false);
                            onCompleteRef.current(answersRef.current);
                            return i;
                        });
                    }
                }

            } else if (globalAnchorRef.current !== null) {
                // ── Global section countdown ────────────────────────────────
                const elapsed = (now - globalAnchorRef.current.time) / 1000;
                const newVal  = Math.max(0, Math.round(globalAnchorRef.current.remaining - elapsed));
                setTimeLeft(newVal);

                if (newVal <= 0) {
                    globalAnchorRef.current = null; // disarm
                    setIsCompleted(true);
                    onCompleteRef.current(answersRef.current);
                }
            }
        }, 250);

        return () => clearInterval(intervalId);
    }, [isActive, isLoadingModule2, section]);

    // ─────────────────────────────────────────────────────────────────────────
    // Effect 4: Advance question after speaking answer is submitted.
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!pendingSpeakingQuestionId) return;
        if (!answers[pendingSpeakingQuestionId]) return;

        setPendingSpeakingQuestionId(null);
        setCurrentIndex((idx) => {
            if (idx < questions.length - 1) return idx + 1;
            setIsCompleted(true);
            setIsActive(false);
            onComplete(answers);
            return idx;
        });
    }, [pendingSpeakingQuestionId, answers, questions.length, onComplete]);

    // ─────────────────────────────────────────────────────────────────────────
    // Adaptive: load Module 2 after Module 1 ends
    // ─────────────────────────────────────────────────────────────────────────
    const loadModule2 = useCallback(async () => {
        if (!isAdaptiveSection || !examType || !section || module2Loaded) return;

        setIsLoadingModule2(true);
        setIsActive(false);

        const module1Answers = Object.entries(answers).filter(([qId]) =>
            module1Questions.some(q => q.id === qId)
        );

        const normalize = (val: any) => String(val ?? "")
            .replace(/^[A-D]\.\s*/i, "")
            .trim();

        const scoredResult = module1Answers.reduce((acc, [qId, answer]) => {
            const question = module1Questions.find(q => q.id === qId);
            if (!question) return acc;

            if (question.questions && question.questions.length > 0) {
                let userMap: Record<string, string> = {};
                try {
                    userMap = typeof answer === "string" && answer.trim().startsWith("{") ? JSON.parse(answer) : {};
                } catch {
                    userMap = {};
                }

                const totalSub = question.questions.length;
                const correctSub = question.questions.reduce((subCount: number, subQ: any, idx: number) => {
                    const userVal = normalize(userMap[idx] ?? userMap[String(idx)] ?? "");
                    const keyVal  = normalize(subQ.answerKey ?? subQ.answer ?? "");
                    return subCount + (userVal !== "" && userVal === keyVal ? 1 : 0);
                }, 0);

                acc.correct += correctSub;
                acc.total   += totalSub;
                return acc;
            }

            const userVal = normalize(answer);
            const keyVal  = normalize(question.answerKey);
            acc.correct += userVal !== "" && userVal === keyVal ? 1 : 0;
            acc.total   += 1;
            return acc;
        }, { correct: 0, total: 0 });

        const module1Score = scoredResult.total > 0
            ? Math.round((scoredResult.correct / scoredResult.total) * 100)
            : 0;

        console.log(`Module 1 Score: ${module1Score}% (${scoredResult.correct}/${scoredResult.total})`);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const response = await fetch("/api/generate-module2", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    examType,
                    section,
                    module1Score,
                    userId: user?.id,
                    generationMode
                })
            });

            if (!response.ok) throw new Error("Failed to generate Module 2");

            const data = await response.json();
            console.log(`Module 2 (${data.moduleType}) loaded: ${data.questions.length} questions`);

            setQuestions(prev => [...prev, ...data.questions]);
            setModule2Loaded(true);
            setModule1Locked(true);
            setCurrentModule(2);
            setIsActive(true);
        } catch (error) {
            console.error("Module 2 loading error:", error);
            setIsCompleted(true);
            onComplete(answers);
        } finally {
            setIsLoadingModule2(false);
        }
    }, [isAdaptiveSection, examType, section, module2Loaded, answers, module1Questions, onComplete, generationMode]);

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────
    const startTest = useCallback(() => setIsActive(true), []);
    const pauseTest = useCallback(() => setIsActive(false), []);

    const submitAnswer = useCallback((answer: any) => {
        setAnswers((prev) => ({
            ...prev,
            [questions[currentIndex].id]: answer
        }));
    }, [currentIndex, questions]);

    const nextQuestion = useCallback(async () => {
        if (isAdaptiveSection && currentIndex === module1EndIndex && !module2Loaded) {
            await loadModule2();
            setCurrentIndex((prev) => prev + 1);
            return;
        }

        if (currentIndex < questions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
        } else {
            setIsCompleted(true);
            setIsActive(false);
            onComplete(answers);
        }
    }, [currentIndex, questions.length, answers, onComplete, isAdaptiveSection, module1EndIndex, module2Loaded, loadModule2]);

    const prevQuestion = useCallback(() => {
        if (isListeningSection) return;
        if (module1Locked && currentIndex <= module1EndIndex) return;
        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
        }
    }, [currentIndex, module1Locked, module1EndIndex, isListeningSection]);

    const canGoBack =
        currentIndex > 0 &&
        !isListeningSection &&
        !(module1Locked && currentIndex <= module1EndIndex + 1);

    return {
        currentIndex,
        currentQuestion: questions[currentIndex],
        totalQuestions: questions.length,
        // Expose whichever clock is active: per-task overrides global
        timeLeft: taskTimeLeft !== null ? taskTimeLeft : timeLeft,
        isActive,
        isCompleted,
        currentAnswer: answers[questions[currentIndex]?.id],
        currentModule,
        isLoadingModule2,
        module1Locked,
        pendingSpeakingQuestionId,
        canGoBack,
        startTest,
        pauseTest,
        submitAnswer,
        nextQuestion,
        prevQuestion
    };
}
