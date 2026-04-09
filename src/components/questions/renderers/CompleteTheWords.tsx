"use client";

import { useState, useEffect } from "react";
import { QuestionData } from "@/types/question";
import { QuestionContainer } from "../QuestionContainer";
import { speakText, stopSpeaking } from "@/lib/audio/tts";
import { Volume2, CheckCircle2, Play } from "lucide-react";
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

type TextPart = { type: 'text'; content: string; index?: never; prefix?: never };
type BlankPart = { type: 'blank'; content: string; index: number; prefix: string };
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
    const [flowState, setFlowState] = useState<FlowState>(
        reviewMode ? 'interacting' : (isListeningSection ? 'initial' : 'interacting')
    );

    const audioText = question.audioTranscript || question.text || "";

    // Parse answerKey "(1) tion (2) ment ..." → { 0: 'tion', 1: 'ment', ... }
    const getCorrectWords = () => {
        const correctMap: { [key: number]: string } = {};
        if (question.answerKey) {
            const matches = Array.from(String(question.answerKey).matchAll(/\((\d+)\)\s*([a-zA-Z0-9']+)/g));
            for (const match of matches) {
                correctMap[parseInt(match[1]) - 1] = match[2];
            }
        }
        return correctMap;
    };

    const correctWords = getCorrectWords();

    // Populate inputs from userAnswer in review mode
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
        return () => { stopSpeaking(); };
    }, [question.id, reviewMode, isListeningSection]);

    const handlePlayAudio = () => {
        setFlowState('playing');
        speakText(audioText, () => {
            setFlowState('interacting');
        });
    };

    // ---------------------------------------------------------------------------
    // Parse the masked text into renderable parts.
    //
    // NEW FORMAT (TOEFL spec, post-fix generator):
    //   "mi___ think th__ prehistoric peo___"
    //   → prefix letters immediately followed by tight underscores (no spaces).
    //   The prefix is part of the word shown in-line; the blank only accepts the hidden suffix.
    //
    // LEGACY FORMAT (fallback, old generator):
    //   "mi _ _ _" — prefix with spaced underscores.
    // ---------------------------------------------------------------------------
    const parseText = (): ParsedPart[] => {
        if (!question.text) return [];

        let rawText = question.text;

        // Unwrap JSON if the AI accidentally returned wrapped text
        try {
            const trimmed = rawText.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                const parsed = JSON.parse(rawText);
                if (Array.isArray(parsed) && parsed.length > 0)
                    rawText = parsed[0].paragraph || parsed[0].text || rawText;
                else
                    rawText = parsed.paragraph || parsed.text || parsed.content || rawText;
            }
        } catch (e) { /* not JSON, keep as-is */ }

        const parts: ParsedPart[] = [];
        let lastIndex = 0;
        let blankIndex = 0;

        // PRIMARY: tight underscore format — "prefix___" optionally followed by punctuation
        // e.g. "mi___" "th__," "peo___."
        const tightRegex = /([a-zA-Z']+)(_{2,})([.,!?;:]*)/g;
        let match: RegExpExecArray | null;
        let foundTight = false;

        tightRegex.lastIndex = 0;
        while ((match = tightRegex.exec(rawText)) !== null) {
            foundTight = true;
            const [full, prefix, _blanks, punct] = match;
            const offset = match.index;

            // Text before this blank
            if (offset > lastIndex) {
                parts.push({ type: 'text', content: rawText.slice(lastIndex, offset) });
            }

            // The blank: we store the visible prefix so the input can be sized to the hidden portion
            parts.push({ type: 'blank', content: '', index: blankIndex, prefix });
            blankIndex++;
            lastIndex = offset + full.length;

            // Re-attach punctuation as plain text so it renders after the input box
            if (punct) {
                parts.push({ type: 'text', content: punct });
            }
        }

        // FALLBACK: spaced underscore format — "prefix _ _ _"
        if (!foundTight) {
            const spacedRegex = /([a-zA-Z0-9']*)\s*((?:_\s*){2,})/g;
            rawText.replace(spacedRegex, (full, prefix, _blanks, offset: number) => {
                if (offset > lastIndex) {
                    parts.push({ type: 'text', content: rawText.slice(lastIndex, offset) });
                }
                if (prefix) parts.push({ type: 'text', content: prefix });
                parts.push({ type: 'blank', content: '', index: blankIndex, prefix: '' });
                blankIndex++;
                lastIndex = offset + full.length;
                return full;
            });
        }

        if (lastIndex < rawText.length) {
            parts.push({ type: 'text', content: rawText.slice(lastIndex) });
        }

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
                        {reviewMode
                            ? 'Review your answers'
                            : flowState === 'playing'
                                ? 'Listen closely...'
                                : `Fill in the missing letters (${blankCount} blanks)`}
                    </p>
                </div>

                {/* Audio loading state */}
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

                {/* Audio playing state */}
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

                {/* Interactive / review state */}
                {flowState === 'interacting' && (
                    <div className="space-y-6">
                        {/* Replay button in review mode for listening tasks */}
                        {reviewMode && isListeningSection && (
                            <button
                                onClick={handlePlayAudio}
                                className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-700 hover:bg-indigo-500/20 transition-colors w-full justify-center mb-6"
                            >
                                <Play className="w-5 h-5" />
                                <span className="text-sm font-medium">Replay Audio</span>
                            </button>
                        )}

                        {/* Audio done banner */}
                        {!reviewMode && isListeningSection && (
                            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-700">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="text-sm font-medium">Audio complete – fill in the blanks</span>
                            </div>
                        )}

                        {/* Passage with inline inputs */}
                        <div className="bg-background p-8 rounded-xl border-2 border-border/60 shadow-sm leading-loose text-lg">
                            {parts.map((part, idx) => {
                                if (part.type === 'text') {
                                    return <span key={idx}>{part.content}</span>;
                                }

                                // Blank part
                                const index = part.index;
                                const prefix = part.prefix ?? '';
                                const userVal = inputs[index] || '';
                                const correctVal = correctWords[index] || '';
                                const isCorrect = userVal.toLowerCase().trim() === correctVal.toLowerCase().trim();

                                // Size the input to the hidden portion (correctVal length in review, 4ch minimum otherwise)
                                const inputWidth = reviewMode
                                    ? Math.max(3, userVal.length + 1)
                                    : Math.max(4, correctVal.length || 4);

                                return (
                                    <span key={idx} className="inline-flex items-baseline mx-0.5 relative group">
                                        {/* Show visible prefix inline */}
                                        {prefix && (
                                            <span className="font-medium">{prefix}</span>
                                        )}
                                        <span className="inline-flex flex-col align-bottom">
                                            <input
                                                type="text"
                                                value={userVal}
                                                readOnly={reviewMode}
                                                autoComplete="off"
                                                onChange={(e) => handleInputChange(index, e.target.value)}
                                                className={cn(
                                                    "border-b-2 text-center px-0.5 bg-transparent focus:outline-none transition-colors font-medium",
                                                    reviewMode
                                                        ? (isCorrect
                                                            ? "border-green-500 text-green-700 bg-green-50/50"
                                                            : "border-red-500 text-red-700 bg-red-50/50 line-through decoration-red-400 opacity-80")
                                                        : "border-primary text-primary focus:border-primary/80"
                                                )}
                                                style={{ width: `${inputWidth}ch` }}
                                            />
                                            {/* Show correct answer above in review mode if wrong */}
                                            {reviewMode && !isCorrect && correctVal && (
                                                <span className="absolute -top-6 left-0 text-xs font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-10">
                                                    {correctVal}
                                                </span>
                                            )}
                                        </span>
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </QuestionContainer>
    );
}
