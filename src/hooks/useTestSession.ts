"use client";

import { useState, useEffect, useCallback } from "react";
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

    const isAdaptiveSection = questions.some(q => q.metadata?.module === 1);
    const module1Questions = questions.filter(q => q.metadata?.module === 1);
    const module1EndIndex = module1Questions.length - 1;

    const isListeningSection = (section || "").toLowerCase() === "listening";

    const getTaskTimeLimit = useCallback((q: QuestionData): number | null => {
        const taskType = (q.taskType || "").toLowerCase();
        const sec = (q.section || section || "").toLowerCase();

        if (sec === "speaking") {
            if (taskType.includes("interview")) return 45;
            if (taskType.includes("repeat")) return 12;
            return 30;
        }

        if (sec === "writing") {
            if (taskType.includes("email")) return 420;
            if (taskType.includes("discussion")) return 600;
        }

        return null;
    }, [section]);

    useEffect(() => {
        const q = questions[currentIndex];
        if (!q) return;
        setTaskTimeLeft(getTaskTimeLimit(q));
    }, [currentIndex, questions, getTaskTimeLimit]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (!isActive || isLoadingModule2) return () => clearInterval(interval);

        if (taskTimeLeft !== null) {
            if (taskTimeLeft <= 0) return () => clearInterval(interval);
            interval = setInterval(() => {
                setTaskTimeLeft((prev) => {
                    if (prev === null) return prev;
                    if (prev <= 1) {
                        clearInterval(interval);
                        const activeQuestion = questions[currentIndex];
                        const activeQuestionId = activeQuestion?.id;
                        const activeSection = (activeQuestion?.section || section || "").toLowerCase();

                        if (activeSection === "speaking" && activeQuestionId) {
                            setIsActive(false);
                            setPendingSpeakingQuestionId(activeQuestionId);
                            return 0;
                        }

                        setCurrentIndex((idx) => {
                            if (idx < questions.length - 1) return idx + 1;
                            setIsCompleted(true);
                            setIsActive(false);
                            onComplete(answers);
                            return idx;
                        });
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }

        if (timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        setIsCompleted(true);
                        onComplete(answers);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft, onComplete, answers, isLoadingModule2, taskTimeLeft, questions, currentIndex, section]);

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
                    const keyVal = normalize(subQ.answerKey ?? subQ.answer ?? "");
                    return subCount + (userVal !== "" && userVal === keyVal ? 1 : 0);
                }, 0);

                acc.correct += correctSub;
                acc.total += totalSub;
                return acc;
            }

            const userVal = normalize(answer);
            const keyVal = normalize(question.answerKey);
            acc.correct += userVal !== "" && userVal === keyVal ? 1 : 0;
            acc.total += 1;
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
