"use client";

import { useEffect, useState } from "react";
import { QuestionData } from "@/types/question";
import { QuestionContainer } from "../QuestionContainer";
import { speakText, stopSpeaking } from "@/lib/audio/tts";
import { Volume2, CheckCircle2, XCircle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIFeedbackTooltip } from "@/components/ui/AIFeedbackTooltip";

interface ListenChooseResponseProps {
    question: QuestionData;
    onAnswer: (answer: string) => void;
    reviewMode?: boolean;
    userAnswer?: string;
    correctAnswer?: string;
    aiFeedback?: string;
}

type FlowState = 'initial' | 'playing' | 'question';

export default function ListenChooseResponse({
    question,
    onAnswer,
    reviewMode = false,
    userAnswer = "",
    correctAnswer = "",
    aiFeedback = ""
}: ListenChooseResponseProps) {
    const [flowState, setFlowState] = useState<FlowState>(reviewMode ? 'question' : 'initial');
    const [selectedAnswer, setSelectedAnswer] = useState<string>(userAnswer);

    const cleanAudioText = (text: string) => {
        if (!text) return "";
        return text
            .replace(/^(Speaker \d+|Speaker|Narrator|Man|Woman|Interviewer):\s*/gmi, "")
            .replace(/\n(Speaker \d+|Speaker|Narrator|Man|Woman|Interviewer):\s*/gmi, "\n");
    };

    const audioText = cleanAudioText(question.audioTranscript || question.text || "");
    const questionPrompt = question.prompt || "Choose the best response.";
    const options = (question.options && question.options.length > 0)
        ? question.options
        : ["Option A", "Option B", "Option C", "Option D"];

    useEffect(() => {
        // Only auto-play in test mode, not review mode
        if (!reviewMode) {
            handlePlayAudio();
        }
        return () => {
            stopSpeaking();
        };
    }, [question.id, reviewMode]);

    const handlePlayAudio = () => {
        setFlowState('playing');
        speakText(audioText, () => {
            setFlowState('question');
        });
    };

    const handleAnswerSelect = (answer: string) => {
        if (reviewMode) return; // Read-only in review mode
        setSelectedAnswer(answer);
        onAnswer(answer);
    };

    // Helper to normalize answers for comparison
    const normalizeAnswer = (ans: string) => ans.replace(/^[A-D]\.\s*/, '').trim();

    return (
        <QuestionContainer question={question} hideHeader={true}>
            <div className="flex flex-col min-h-[500px] max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8 space-y-2">
                    <span className="bg-teal-500/10 text-teal-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                        Listening Comprehension
                    </span>
                    <div className="flex items-center justify-center gap-2">
                        <h2 className="text-2xl font-bold">Listen and Choose a Response</h2>
                        {reviewMode && aiFeedback && <AIFeedbackTooltip feedback={aiFeedback} />}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {reviewMode ? 'Review your answer' : flowState === 'playing' ? 'Listen carefully...' : flowState === 'question' ? 'Choose the best response' : 'Preparing audio...'}
                    </p>
                </div>

                {/* Initial Loading State */}
                {flowState === 'initial' && !reviewMode && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center space-y-4">
                            <div className="w-20 h-20 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto">
                                <Volume2 className="w-10 h-10 text-teal-500 animate-pulse" />
                            </div>
                            <p className="text-lg">Loading audio...</p>
                        </div>
                    </div>
                )}

                {/* Audio Playing State */}
                {flowState === 'playing' && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center space-y-6">
                            <div className="w-32 h-32 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto relative">
                                <Volume2 className="w-16 h-16 text-teal-500" />
                                <div className="absolute inset-0 rounded-full border-4 border-teal-500/30 animate-ping"></div>
                            </div>
                            <div>
                                <h3 className="text-xl font-medium mb-2">Audio playing...</h3>
                                <p className="text-sm text-muted-foreground">
                                    Listen carefully to the statement.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Question Display State */}
                {flowState === 'question' && (
                    <div className="space-y-6">
                        {/* Audio Complete or Replay Button */}
                        {reviewMode ? (
                            <button
                                onClick={handlePlayAudio}
                                className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-700 hover:bg-blue-500/20 transition-colors w-full justify-center"
                            >
                                <Play className="w-5 h-5" />
                                <span className="text-sm font-medium">Replay Audio</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-700">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="text-sm font-medium">Audio complete</span>
                            </div>
                        )}

                        {/* Options with Dual Highlighting in Review Mode */}
                        <div className="space-y-2">
                            {options.map((option, optIdx) => {
                                const optionLetter = String.fromCharCode(65 + optIdx);
                                const cleanOption = normalizeAnswer(option);
                                const cleanUserAnswer = normalizeAnswer(userAnswer);
                                const cleanCorrectAnswer = normalizeAnswer(correctAnswer);

                                const isUserChoice = reviewMode && cleanOption === cleanUserAnswer;
                                const isCorrectChoice = reviewMode && cleanOption === cleanCorrectAnswer;
                                const isSelected = !reviewMode && selectedAnswer === option;

                                return (
                                    <button
                                        key={optIdx}
                                        onClick={() => handleAnswerSelect(option)}
                                        disabled={reviewMode}
                                        className={cn(
                                            "w-full text-left p-4 rounded-lg border-2 transition-all",
                                            // Review mode styling
                                            reviewMode && isCorrectChoice && "bg-green-50 border-green-500",
                                            reviewMode && isUserChoice && !isCorrectChoice && "bg-red-50 border-red-500",
                                            reviewMode && !isUserChoice && !isCorrectChoice && "bg-background border-border opacity-60",
                                            // Test mode styling
                                            !reviewMode && isSelected && "border-primary bg-primary/5",
                                            !reviewMode && !isSelected && "border-border hover:border-primary/50 hover:bg-accent",
                                            // Disabled cursor
                                            reviewMode && "cursor-default"
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium mr-2">{optionLetter}.</span>
                                                {cleanOption}
                                            </div>
                                            {reviewMode && isCorrectChoice && (
                                                <span className="flex items-center gap-1 text-green-700 font-semibold text-sm">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    Correct
                                                </span>
                                            )}
                                            {reviewMode && isUserChoice && !isCorrectChoice && (
                                                <span className="flex items-center gap-1 text-red-700 font-semibold text-sm">
                                                    <XCircle className="w-4 h-4" />
                                                    Your Answer
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </QuestionContainer>
    );
}
