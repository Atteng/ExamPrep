"use client";

import { useEffect, useState } from "react";
import { QuestionData } from "@/types/question";
import { QuestionContainer } from "../QuestionContainer";
import { speakConversation, stopSpeaking } from "@/lib/audio/tts";
import { Volume2, CheckCircle2, XCircle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIFeedbackTooltip } from "@/components/ui/AIFeedbackTooltip";

interface ListenConversationProps {
    question: QuestionData;
    onAnswer: (answer: string) => void;
    reviewMode?: boolean;
    userAnswer?: string; // JSON string for multi-answers
    correctAnswer?: string; // JSON string or simple correct answer logic
    aiFeedback?: string;
}

type FlowState = 'initial' | 'playing' | 'questions';

export default function ListenConversation({
    question,
    onAnswer,
    reviewMode = false,
    userAnswer = "{}",
    correctAnswer = "",
    aiFeedback = ""
}: ListenConversationProps) {
    const [flowState, setFlowState] = useState<FlowState>(reviewMode ? 'questions' : 'initial');
    const [answers, setAnswers] = useState<{ [key: number]: string }>({});
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    const cleanAudioText = (text: string) => {
        if (!text) return "";
        return text
            .replace(/^(Speaker \d+|Speaker|Narrator|Man|Woman|Interviewer):\s*/gmi, "")
            .replace(/\n(Speaker \d+|Speaker|Narrator|Man|Woman|Interviewer):\s*/gmi, "\n");
    };

    const conversationTranscript = cleanAudioText(question.text || "");

    const questions = question.questions?.map((q: any, idx) => ({
        id: idx,
        text: q.prompt || q.text || q.question || "Choose the best answer.",
        options: q.options || [],
        correctAnswer: q.answerKey
    })) || [{
        id: 0,
        text: question.prompt || question.text || "What does the conversation mainly discuss?",
        options: question.options || [],
        correctAnswer: question.answerKey
    }];

    // Parse answers in review mode
    useEffect(() => {
        if (reviewMode && userAnswer) {
            try {
                // userAnswer is expected to be a JSON string like '{"0":"Option A","1":"Option B"}'
                // Check if it's already an object (hydration sometimes does this) or string
                const parsed = typeof userAnswer === 'string' ? JSON.parse(userAnswer) : userAnswer;
                setAnswers(parsed);
            } catch (e) {
                console.error("Failed to parse user answers", e);
            }
        }
    }, [reviewMode, userAnswer]);

    useEffect(() => {
        if (!reviewMode) {
            handlePlayAudio();
        }
        return () => {
            stopSpeaking();
        };
    }, [question.id, reviewMode]);

    const handlePlayAudio = () => {
        setFlowState('playing');
        speakConversation(conversationTranscript, () => {
            setFlowState('questions');
        });
    };

    const handleAnswerSelect = (answer: string) => {
        if (reviewMode) return;

        const updatedAnswers = {
            ...answers,
            [currentQuestionIndex]: answer
        };
        setAnswers(updatedAnswers);

        setTimeout(() => {
            if (currentQuestionIndex < questions.length - 1) {
                setCurrentQuestionIndex(prev => prev + 1);
            } else {
                onAnswer(JSON.stringify(updatedAnswers));
            }
        }, 600);
    };

    const normalizeAnswer = (ans: string) => ans ? ans.replace(/^[A-D]\.\s*/, '').trim() : "";

    // In Review Mode, we render ALL questions or use internal pagination?
    // Let's render all questions vertically for better review overview
    // But keep the 'pagination' for Test Mode

    // Actually, user asked for pagination buttons.
    // If we are in review mode, we can show them in a list. It's clearer.

    return (
        <QuestionContainer question={question} hideHeader={true}>
            <div className="flex flex-col min-h-[500px] max-w-3xl mx-auto">
                <div className="text-center mb-8 space-y-2">
                    <span className="bg-blue-500/10 text-blue-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                        Listening Comprehension
                    </span>
                    <div className="flex items-center justify-center gap-2">
                        <h2 className="text-2xl font-bold">Listen to a Conversation</h2>
                        {reviewMode && aiFeedback && <AIFeedbackTooltip feedback={aiFeedback} />}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {reviewMode ? 'Review your answers' : flowState === 'playing' ? 'Listen carefully...' : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
                    </p>
                </div>

                {flowState === 'initial' && !reviewMode && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center space-y-4">
                            <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto">
                                <Volume2 className="w-10 h-10 text-blue-500 animate-pulse" />
                            </div>
                            <p className="text-lg">Loading audio...</p>
                        </div>
                    </div>
                )}

                {flowState === 'playing' && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center space-y-6">
                            <div className="w-32 h-32 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto relative">
                                <Volume2 className="w-16 h-16 text-blue-500" />
                                <div className="absolute inset-0 rounded-full border-4 border-blue-500/30 animate-ping"></div>
                            </div>
                            <div>
                                <h3 className="text-xl font-medium mb-2">Audio playing...</h3>
                                <p className="text-sm text-muted-foreground">
                                    Listen carefully. The audio will play only once.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {flowState === 'questions' && (
                    <div className="space-y-6">
                        {/* Audio Replay / Status */}
                        {reviewMode ? (
                            <button
                                onClick={handlePlayAudio}
                                className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-700 hover:bg-blue-500/20 transition-colors w-full justify-center mb-6"
                            >
                                <Play className="w-5 h-5" />
                                <span className="text-sm font-medium">Replay Conversation</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-700">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="text-sm font-medium">Audio complete</span>
                            </div>
                        )}

                        {/* Questions List (Review Mode) OR Single Question (Test Mode) */}
                        {reviewMode ? (
                            <div className="space-y-12">
                                {questions.map((q, idx) => {
                                    const userAns = answers[idx] || "";
                                    const correctAns = q.correctAnswer || "";

                                    return (
                                        <div key={idx} className="space-y-4 border-b pb-8 last:border-0">
                                            <h3 className="font-semibold text-lg">{idx + 1}. {q.text}</h3>
                                            <div className="space-y-2">
                                                {q.options.map((option: string, optIdx: number) => {
                                                    const optionLetter = String.fromCharCode(65 + optIdx);
                                                    const cleanOption = normalizeAnswer(option);
                                                    const cleanUserAnswer = normalizeAnswer(userAns);
                                                    const cleanCorrectAnswer = normalizeAnswer(correctAns);

                                                    const isUserChoice = cleanOption === cleanUserAnswer;
                                                    const isCorrectChoice = cleanOption === cleanCorrectAnswer;

                                                    return (
                                                        <div
                                                            key={optIdx}
                                                            className={cn(
                                                                "w-full text-left p-4 rounded-lg border-2 transition-all flex items-center justify-between",
                                                                isCorrectChoice && "bg-green-50 border-green-500",
                                                                isUserChoice && !isCorrectChoice && "bg-red-50 border-red-500",
                                                                !isUserChoice && !isCorrectChoice && "bg-background border-border opacity-70"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium mr-2">{optionLetter}.</span>
                                                                {cleanOption}
                                                            </div>
                                                            {isCorrectChoice && (
                                                                <span className="flex items-center gap-1 text-green-700 font-semibold text-sm">
                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                    Correct
                                                                </span>
                                                            )}
                                                            {isUserChoice && !isCorrectChoice && (
                                                                <span className="flex items-center gap-1 text-red-700 font-semibold text-sm">
                                                                    <XCircle className="w-4 h-4" />
                                                                    Your Answer
                                                                </span>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* Test Mode: Single Question with Auto-Advance */
                            <div className="space-y-2">
                                <h3 className="font-medium text-lg mb-4">{questions[currentQuestionIndex].text}</h3>
                                {questions[currentQuestionIndex].options.map((option: string, optIdx: number) => {
                                    const optionLetter = String.fromCharCode(65 + optIdx);
                                    const isSelected = answers[currentQuestionIndex] === option;

                                    return (
                                        <button
                                            key={optIdx}
                                            onClick={() => handleAnswerSelect(option)}
                                            className={cn(
                                                "w-full text-left p-4 rounded-lg border-2 transition-all",
                                                isSelected
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-primary/50 hover:bg-accent"
                                            )}
                                        >
                                            <span className="font-medium mr-2">{optionLetter}.</span>
                                            {option.replace(/^[A-D]\.\s*/, '')}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </QuestionContainer>
    );
}
