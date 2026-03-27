"use client";

import { useState, useEffect, useCallback } from "react";
import { QuestionData } from "@/types/question";
import { supabase } from "@/lib/supabase";

interface UseTestSessionProps {
    questions: QuestionData[];
    timeLimit: number; // in seconds
    onComplete: (results: any) => void;
    examType?: string; // e.g., 'toefl'
    section?: string; // e.g., 'reading', 'listening'
    generationMode?: 'balanced' | 'fresh' | 'fast';
}

export function useTestSession({ questions: initialQuestions, timeLimit, onComplete, examType, section, generationMode = 'balanced' }: UseTestSessionProps) {
    const [questions, setQuestions] = useState<QuestionData[]>(initialQuestions);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    // Section timer (used for Reading/Listening/Writing)
    const [timeLeft, setTimeLeft] = useState(timeLimit);
    // Per-task timer (used for Speaking)
    const [taskTimeLeft, setTaskTimeLeft] = useState<number | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);

    // Module state
    const [currentModule, setCurrentModule] = useState<1 | 2>(1);
    const [module1Locked, setModule1Locked] = useState(false);
    const [isLoadingModule2, setIsLoadingModule2] = useState(false);
    const [module2Loaded, setModule2Loaded] = useState(false);

    // Check if this is an adaptive section (Reading or Listening with Module 1 questions)
    const isAdaptiveSection = questions.some(q => q.metadata?.module === 1);
    const module1Questions = questions.filter(q => q.metadata?.module === 1);
    const module1EndIndex = module1Questions.length - 1;

    const isSpeakingSection = (section || '').toLowerCase() === 'speaking';
    const isListeningSection = (section || '').toLowerCase() === 'listening';

    const getSpeakingTaskTime = useCallback((q: QuestionData): number => {
        const taskType = (q.taskType || "").toLowerCase();
        // From TOEFL iBT Overview New Format (txt extract): Interview responses are 45 seconds each.
        if (taskType.includes('interview')) return 45;
        // Listen & Repeat is a short repeat task; keep it strict to simulate timed repetition.
        if (taskType.includes('repeat')) return 15;
        // Default speaking fallback
        return 30;
    }, []);

    // When question changes, reset task timer for speaking.
    useEffect(() => {
        if (!isSpeakingSection) {
            setTaskTimeLeft(null);
            return;
        }
        const q = questions[currentIndex];
        if (!q) return;
        setTaskTimeLeft(getSpeakingTaskTime(q));
    }, [currentIndex, isSpeakingSection, questions, getSpeakingTaskTime]);

    // Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (!isActive || isLoadingModule2) return () => clearInterval(interval);

        // Speaking: per-task timer (auto-advance when a task ends)
        if (isSpeakingSection) {
            if (taskTimeLeft === null || taskTimeLeft <= 0) return () => clearInterval(interval);
            interval = setInterval(() => {
                setTaskTimeLeft((prev) => {
                    if (prev === null) return prev;
                    if (prev <= 1) {
                        clearInterval(interval);
                        // Auto-advance to next question (or complete). Speaking isn't adaptive.
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

        // Other sections: section timer (auto-submit when section ends)
        if (timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        setIsCompleted(true);
                        onComplete(answers); // Auto-submit
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft, onComplete, answers, isLoadingModule2, isSpeakingSection, taskTimeLeft, questions.length]);

    // Module transition logic
    const loadModule2 = useCallback(async () => {
        if (!isAdaptiveSection || !examType || !section || module2Loaded) return;

        setIsLoadingModule2(true);
        setIsActive(false); // Pause timer during transition

        // Calculate Module 1 score
        const module1Answers = Object.entries(answers).filter(([qId]) =>
            module1Questions.some(q => q.id === qId)
        );

        const normalize = (val: any) => String(val ?? "")
            .replace(/^[A-D]\.\s*/i, "")
            .trim();

        const correctCount = module1Answers.reduce((count, [qId, answer]) => {
            const question = module1Questions.find(q => q.id === qId);
            if (!question) return count;

            // Listening sets: answer is JSON map { "0": "...", "1": "..." } and keys are per sub-question.
            if (question.questions && question.questions.length > 0) {
                let userMap: Record<string, string> = {};
                try {
                    userMap = typeof answer === 'string' && answer.trim().startsWith('{') ? JSON.parse(answer) : {};
                } catch {
                    userMap = {};
                }

                const totalSub = question.questions.length;
                const correctSub = question.questions.reduce((subCount: number, subQ: any, idx: number) => {
                    const userVal = normalize(userMap[idx] ?? userMap[String(idx)] ?? "");
                    const keyVal = normalize(subQ.answerKey ?? subQ.answer ?? "");
                    return subCount + (userVal !== "" && userVal === keyVal ? 1 : 0);
                }, 0);

                // Count this set as "correct" if majority of its sub-questions are correct.
                if (totalSub > 0 && correctSub / totalSub >= 0.6) return count + 1;
                return count;
            }

            // Standard single question logic
            const userVal = normalize(answer);
            const keyVal = normalize(question.answerKey);
            return count + (userVal !== "" && userVal === keyVal ? 1 : 0);
        }, 0);
        const module1Score = module1Questions.length > 0
            ? Math.round((correctCount / module1Questions.length) * 100)
            : 0;

        console.log(`📊 Module 1 Score: ${module1Score}% (${correctCount}/${module1Questions.length})`);

        try {
            // Get current user for history tracking
            const { data: { user } } = await supabase.auth.getUser();

            // Fetch Module 2 questions
            const response = await fetch('/api/generate-module2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    examType,
                    section,
                    module1Score,
                    userId: user?.id,
                    generationMode
                })
            });

            if (!response.ok) throw new Error('Failed to generate Module 2');

            const data = await response.json();
            console.log(`✅ Module 2 (${data.moduleType}) loaded: ${data.questions.length} questions`);

            // Append Module 2 questions
            setQuestions(prev => [...prev, ...data.questions]);
            setModule2Loaded(true);
            setModule1Locked(true);
            setCurrentModule(2);
            setIsActive(true); // Resume timer

        } catch (error) {
            console.error('Module 2 loading error:', error);
            // Fallback: just complete the test with Module 1 only
            setIsCompleted(true);
            onComplete(answers);
        } finally {
            setIsLoadingModule2(false);
        }
    }, [isAdaptiveSection, examType, section, module2Loaded, answers, module1Questions, onComplete]);

    const startTest = useCallback(() => setIsActive(true), []);
    const pauseTest = useCallback(() => setIsActive(false), []);

    const submitAnswer = useCallback((answer: any) => {
        setAnswers((prev) => ({
            ...prev,
            [questions[currentIndex].id]: answer
        }));
    }, [currentIndex, questions]);

    const nextQuestion = useCallback(async () => {
        // Check if we're at the end of Module 1
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
        // TOEFL Listening: no going back to previous questions once you move on.
        if (isListeningSection) return;

        // Prevent going back to Module 1 if in Module 2
        if (module1Locked && currentIndex <= module1EndIndex) {
            return; // Block navigation
        }

        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
        }
    }, [currentIndex, module1Locked, module1EndIndex, isListeningSection]);

    // Determine if "Back" button should be disabled
    const canGoBack =
        currentIndex > 0 &&
        !isListeningSection &&
        !(module1Locked && currentIndex <= module1EndIndex + 1);

    return {
        currentIndex,
        currentQuestion: questions[currentIndex],
        totalQuestions: questions.length,
        timeLeft: isSpeakingSection ? (taskTimeLeft ?? 0) : timeLeft,
        isActive,
        isCompleted,
        currentAnswer: answers[questions[currentIndex]?.id],
        currentModule,
        isLoadingModule2,
        module1Locked,
        canGoBack,
        startTest,
        pauseTest,
        submitAnswer,
        nextQuestion,
        prevQuestion
    };
}
