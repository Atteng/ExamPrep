"use client";

import { useEffect, useState } from "react";
import { QuestionData } from "@/types/question";
import { QuestionContainer } from "../QuestionContainer";
import { speakText, stopSpeaking } from "@/lib/audio/tts";
import { Volume2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListenChooseResponseProps {
    question: QuestionData;
    onAnswer: (answer: string) => void;
}

type FlowState = 'initial' | 'playing' | 'question';

export default function ListenChooseResponse({ question, onAnswer }: ListenChooseResponseProps) {
    const [flowState, setFlowState] = useState<FlowState>('initial');
    const [selectedAnswer, setSelectedAnswer] = useState<string>("");

    const audioText = question.audioTranscript || question.text || "";
    const questionPrompt = question.prompt || "Choose the best response.";
    const options = question.options || [];

    useEffect(() => {
        handlePlayAudio();
        return () => {
            stopSpeaking();
        };
    }, [question.id]);

    const handlePlayAudio = () => {
        setFlowState('playing');
        speakText(audioText, () => {
            setFlowState('question');
        });
    };

    const handleAnswerSelect = (answer: string) => {
        setSelectedAnswer(answer);
    };

    const handleSubmit = () => {
        onAnswer(selectedAnswer);
    };

    return (
        <QuestionContainer question={question}>
            <div className="flex flex-col min-h-[500px] max-w-3xl mx-auto">

                <div className="text-center mb-8 space-y-2">
                    <span className="bg-teal-500/10 text-teal-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                        Listening Comprehension
                    </span>
                    <h2 className="text-2xl font-bold">Listen and Choose a Response</h2>
                    <p className="text-sm text-muted-foreground">
                        {flowState === 'playing' ? 'Listen carefully...' : flowState === 'question' ? 'Choose the best response' : 'Preparing audio...'}
                    </p>
                </div>

                {flowState === 'initial' && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center space-y-4">
                            <div className="w-20 h-20 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto">
                                <Volume2 className="w-10 h-10 text-teal-500 animate-pulse" />
                            </div>
                            <p className="text-lg">Loading audio...</p>
                        </div>
                    </div>
                )}

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

                {flowState === 'question' && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-700">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="text-sm font-medium">Audio complete</span>
                        </div>

                        <div className="space-y-4 p-6 border rounded-lg bg-card">
                            <h3 className="font-medium text-lg">
                                {questionPrompt}
                            </h3>

                            <div className="space-y-2">
                                {options.map((option, optIdx) => {
                                    const optionLetter = String.fromCharCode(65 + optIdx);
                                    const isSelected = selectedAnswer === option;

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
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={!selectedAnswer}
                            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Submit Answer
                        </button>
                    </div>
                )}
            </div>
        </QuestionContainer>
    );
}
