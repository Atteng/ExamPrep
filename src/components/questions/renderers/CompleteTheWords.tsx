"use client";

import { useState, useEffect } from "react";
import { QuestionData } from "@/types/question";
import { QuestionContainer } from "../QuestionContainer";
import { speakText, stopSpeaking } from "@/lib/audio/tts";
import { Volume2, CheckCircle2, XCircle, Play, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIFeedbackTooltip } from "@/components/ui/AIFeedbackTooltip";

interface CompleteTheWordsProps {
    question: QuestionData;
    onAnswer: (answer: string) => void;
    reviewMode?: boolean;
    userAnswer?: string;
    correctAnswer?: string;
    aiFeedback?: string;
}

type FlowState = 'initial' | 'playing' | 'interacting';

type TextPart = { type: 'text'; content: string; index?: never };
type BlankPart = { type: 'blank'; content: string; index: number };
type ParsedPart = TextPart | BlankPart;

export default function CompleteTheWords({
    question,
    onAnswer,
    reviewMode = false,
    userAnswer = "",
    correctAnswer = "",
    aiFeedback = ""
}: CompleteTheWordsProps) {
    const isListeningSection = question.section === 'listening' || question.section === 'speaking';
    const [inputs, setInputs] = useState<{ [key: number]: string }>({});
    // Initial state depends on section
    // Reading -> Interacting immediately
    // Listening -> Initial (loading audio)
    const [flowState, setFlowState] = useState<FlowState>(
        reviewMode ? 'interacting' : (isListeningSection ? 'initial' : 'interacting')
    );

    const audioText = question.audioTranscript || question.text || "";

    // Parse answers to get correct words for each blank
    const getCorrectWords = () => {
        const correctMap: { [key: number]: string } = {};
        if (question.answerKey) {
            // Match format like "(1) brown (2) jumps"
            const matches = Array.from(String(question.answerKey).matchAll(/\(?(\d+)\)?\s*([a-zA-Z0-9']+)/g));
            for (const match of matches) {
                // Adjust index to 0-based if key is 1-based
                const index = parseInt(match[1]) - 1;
                correctMap[index] = match[2];
            }
        }
        return correctMap;
    };

    const correctWords = getCorrectWords();

    // Parse user answers from comma-separated string in review mode
    useEffect(() => {
        if (reviewMode && userAnswer) {
            const userParts = userAnswer.split(',');
            const newInputs: { [key: number]: string } = {};
            userParts.forEach((part, idx) => {
                newInputs[idx] = part.trim();
            });
            setInputs(newInputs);
        }
    }, [reviewMode, userAnswer]);

    useEffect(() => {
        if (!reviewMode && isListeningSection) {
            handlePlayAudio();
        }
        return () => {
            stopSpeaking();
        };
    }, [question.id, reviewMode, isListeningSection]);

    const handlePlayAudio = () => {
        setFlowState('playing');
        speakText(audioText, () => {
            setFlowState('interacting');
        });
    };

    // Parse the text to find blanks (format: "word_ _ _")
    const parseText = (): ParsedPart[] => {
        if (!question.text) return [];

        let rawText = question.text;

        // Try to clean up JSON if present
        try {
            const trimmed = rawText.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                const parsed = JSON.parse(rawText);
                if (Array.isArray(parsed) && parsed.length > 0) rawText = parsed[0].paragraph || parsed[0].text || rawText;
                else rawText = parsed.paragraph || parsed.text || parsed.content || rawText;
            }
        } catch (e) { }

        const parts: ParsedPart[] = [];
        // Match optional prefix word + sequence of underscores
        // Improved regex to catch "word___" or "word _ _ _"

        let lastIndex = 0;
        let blankIndex = 0;

        // Simple fallback regex if strict parsing fails
        const fallbackRegex = /([a-zA-Z0-9']*)\s*((?:_ ?_ ?)+)/g;

        rawText.replace(fallbackRegex, (match, prefix, blanks, offset) => {
            if (offset > lastIndex) {
                parts.push({ type: 'text', content: rawText.slice(lastIndex, offset) });
            }

            if (prefix) {
                parts.push({ type: 'text', content: prefix });
            }

            parts.push({ type: 'blank', content: '', index: blankIndex });
            blankIndex++;
            lastIndex = offset + match.length;
            return match;
        });

        if (lastIndex < rawText.length) {
            parts.push({ type: 'text', content: rawText.slice(lastIndex) });
        }

        // Fallback: if regex didn't find blanks but text has them
        if (parts.length === 0 && rawText.includes('_')) {
            return [{ type: 'text', content: rawText }];
        }
        // If empty parts (no match), return raw text
        if (parts.length === 0) return [{ type: 'text', content: rawText }];

        return parts;
    };

    const parts = parseText();
    const blankCount = parts.filter(p => p.type === 'blank').length;

    const handleInputChange = (index: number, value: string) => {
        const newInputs = { ...inputs, [index]: value };
        setInputs(newInputs);
        const answers = Object.keys(newInputs)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(key => newInputs[parseInt(key)] || '')
            .join(',');
        onAnswer(answers);
    };

    return (
        <QuestionContainer question={question} hideHeader={true}>
            <div className="flex flex-col min-h-[400px] max-w-3xl mx-auto">
                <div className="text-center mb-6 space-y-2">
                    <span className="bg-indigo-500/10 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                        {isListeningSection ? 'Listening & Grammar' : 'Reading & Grammar'}
                    </span>
                    <div className="flex items-center justify-center gap-2">
                        <h2 className="text-2xl font-bold">Complete the Words</h2>
                        {reviewMode && aiFeedback && <AIFeedbackTooltip feedback={aiFeedback} />}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {reviewMode ? 'Review your answers' : (flowState === 'playing' ? 'Listen closely...' : 'Fill in the missing letters')}
                    </p>
                </div>

                {flowState === 'initial' && !reviewMode && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center space-y-4">
                            <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto">
                                <Volume2 className="w-10 h-10 text-indigo-500 animate-pulse" />
                            </div>
                            <p className="text-lg">Loading audio...</p>
                        </div>
                    </div>
                )}

                {flowState === 'playing' && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center space-y-6">
                            <div className="w-32 h-32 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto relative">
                                <Volume2 className="w-16 h-16 text-indigo-500" />
                                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30 animate-ping"></div>
                            </div>
                            <div>
                                <h3 className="text-xl font-medium mb-2">Audio playing...</h3>
                                <p className="text-sm text-muted-foreground">
                                    Type the missing words as you listen.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {flowState === 'interacting' && (
                    <div className="space-y-6">
                        {reviewMode && isListeningSection ? (
                            <button
                                onClick={handlePlayAudio}
                                className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-700 hover:bg-indigo-500/20 transition-colors w-full justify-center mb-6"
                            >
                                <Play className="w-5 h-5" />
                                <span className="text-sm font-medium">Replay Audio</span>
                            </button>
                        ) : null}

                        {!reviewMode && isListeningSection && (
                            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-700">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="text-sm font-medium">Audio complete - Fill in the blanks</span>
                            </div>
                        )}

                        <div className="bg-background p-8 rounded-xl border-2 border-border/60 shadow-sm leading-loose text-lg">
                            {parts.map((part, idx) => {
                                if (part.type === 'text') {
                                    return <span key={idx}>{part.content}</span>;
                                } else if (part.type === 'blank') {
                                    // TypeScript now knows part.index exists because type is 'blank'
                                    const index = part.index;
                                    const userVal = inputs[index] || '';
                                    const correctVal = correctWords[index] || '';
                                    const isCorrect = userVal.toLowerCase().trim() === correctVal.toLowerCase().trim();

                                    // In review mode:
                                    // If correct: show Green input
                                    // If incorrect: show Red input + (Correct Value)

                                    return (
                                        <span key={idx} className="inline-flex flex-col mx-1 align-bottom relative group">
                                            <input
                                                type="text"
                                                value={userVal}
                                                readOnly={reviewMode}
                                                onChange={(e) => handleInputChange(index, e.target.value)}
                                                className={cn(
                                                    "border-b-2 text-center min-w-[3em] px-1 bg-transparent focus:outline-none transition-colors font-medium",
                                                    reviewMode
                                                        ? (isCorrect
                                                            ? "border-green-500 text-green-700 bg-green-50/50"
                                                            : "border-red-500 text-red-700 bg-red-50/50 line-through decoration-red-400 opacity-80")
                                                        : "border-primary text-primary focus:border-primary/80"
                                                )}
                                                style={{ width: `${Math.max(3, (reviewMode ? userVal.length : 0) + 1)}ch` }}
                                            />
                                            {reviewMode && !isCorrect && correctVal && (
                                                <span className="absolute -top-6 left-0 text-xs font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-10">
                                                    {correctVal}
                                                </span>
                                            )}
                                        </span>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>
                )}
            </div>
        </QuestionContainer>
    );
}
