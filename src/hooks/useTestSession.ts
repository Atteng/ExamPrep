"use client";

import { useState, useEffect, useCallback } from "react";
import { QuestionData } from "@/types/question";

interface UseTestSessionProps {
    questions: QuestionData[];
    timeLimit: number; // in seconds
    onComplete: (results: any) => void;
    examType?: string; // e.g., 'toefl'
    section?: string; // e.g., 'reading', 'listening'
}

export function useTestSession({ questions: initialQuestions, timeLimit, onComplete, examType, section }: UseTestSessionProps) {
    const [questions, setQuestions] = useState<QuestionData[]>(initialQuestions);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [timeLeft, setTimeLeft] = useState(timeLimit);
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

    // Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive && timeLeft > 0 && !isLoadingModule2) {
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
    }, [isActive, timeLeft, onComplete, answers, isLoadingModule2]);

    // Module transition logic
    const loadModule2 = useCallback(async () => {
        if (!isAdaptiveSection || !examType || !section || module2Loaded) return;

        setIsLoadingModule2(true);
        setIsActive(false); // Pause timer during transition

        // Calculate Module 1 score
        const module1Answers = Object.entries(answers).filter(([qId]) =>
            module1Questions.some(q => q.id === qId)
        );
        const correctCount = module1Answers.filter(([qId, answer]) => {
            const question = module1Questions.find(q => q.id === qId);
            return question && String(answer).trim() === String(question.answerKey).trim();
        }).length;
        const module1Score = module1Questions.length > 0
            ? Math.round((correctCount / module1Questions.length) * 100)
            : 0;

        console.log(`📊 Module 1 Score: ${module1Score}% (${correctCount}/${module1Questions.length})`);

        try {
            // Fetch Module 2 questions
            const response = await fetch('/api/generate-module2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examType, section, module1Score })
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
        // Prevent going back to Module 1 if in Module 2
        if (module1Locked && currentIndex <= module1EndIndex) {
            return; // Block navigation
        }

        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
        }
    }, [currentIndex, module1Locked, module1EndIndex]);

    // Determine if "Back" button should be disabled
    const canGoBack = currentIndex > 0 && !(module1Locked && currentIndex <= module1EndIndex + 1);

    return {
        currentIndex,
        currentQuestion: questions[currentIndex],
        totalQuestions: questions.length,
        timeLeft,
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
