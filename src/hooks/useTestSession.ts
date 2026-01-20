"use client";

import { useState, useEffect, useCallback } from "react";
import { QuestionData } from "@/types/question";

interface UseTestSessionProps {
    questions: QuestionData[];
    timeLimit: number; // in seconds
    onComplete: (results: any) => void;
}

export function useTestSession({ questions, timeLimit, onComplete }: UseTestSessionProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [timeLeft, setTimeLeft] = useState(timeLimit);
    const [isActive, setIsActive] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);

    // Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive && timeLeft > 0) {
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
    }, [isActive, timeLeft, onComplete, answers]);

    const startTest = useCallback(() => setIsActive(true), []);
    const pauseTest = useCallback(() => setIsActive(false), []);

    const submitAnswer = useCallback((answer: any) => {
        setAnswers((prev) => ({
            ...prev,
            [questions[currentIndex].id]: answer
        }));
    }, [currentIndex, questions]);

    const nextQuestion = useCallback(() => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
        } else {
            setIsCompleted(true);
            setIsActive(false);
            onComplete(answers);
        }
    }, [currentIndex, questions.length, answers, onComplete]);

    const prevQuestion = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
        }
    }, [currentIndex]);

    return {
        currentIndex,
        currentQuestion: questions[currentIndex],
        totalQuestions: questions.length,
        timeLeft,
        isActive,
        isCompleted,
        currentAnswer: answers[questions[currentIndex]?.id],
        startTest,
        pauseTest,
        submitAnswer,
        nextQuestion,
        prevQuestion
    };
}
