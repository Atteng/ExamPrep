"use client";

import { useState, useEffect } from "react";
import { QuestionData } from "@/types/question";
import { cn } from "@/lib/utils";
import { Copy, RefreshCw, X } from "lucide-react";

interface BuildSentenceProps {
    question: QuestionData;
    onAnswer: (answer: string) => void;
}

export default function BuildSentence({ question, onAnswer }: BuildSentenceProps) {
    const { prompt, example, context } = question.structure || {};
    // Fallback if structure is missing (shouldn't happen with our generator)
    const scrambledParts: string[] = example?.scrambled_parts || question.options || [];
    const questionPrompt = prompt || "Make an appropriate sentence.";
    const questionContext = context || question.prompt || "";

    const [availableParts, setAvailableParts] = useState<string[]>([]);
    const [selectedParts, setSelectedParts] = useState<string[]>([]);

    // Initialize - randomized via the generator, but we can shuffle again to be sure if needed.
    // However, usually the generator provides them scrambled.
    useEffect(() => {
        setAvailableParts(scrambledParts);
        setSelectedParts([]);
        onAnswer("");
    }, [question.id]); // Reset on new question

    const handleSelectPart = (part: string, index: number) => {
        const newSelected = [...selectedParts, part];
        const newAvailable = [...availableParts];
        newAvailable.splice(index, 1);

        setSelectedParts(newSelected);
        setAvailableParts(newAvailable);
        onAnswer(newSelected.join(" "));
    };

    const handleRemovePart = (part: string, index: number) => {
        const newAvailable = [...availableParts, part];
        const newSelected = [...selectedParts];
        newSelected.splice(index, 1);

        setSelectedParts(newSelected);
        setAvailableParts(newAvailable);
        onAnswer(newSelected.join(" "));
    };

    const handleReset = () => {
        setAvailableParts(scrambledParts);
        setSelectedParts([]);
        onAnswer("");
    };

    return (
        <div className="flex flex-col h-full max-w-3xl mx-auto space-y-6">
            <div className="bg-card p-6 rounded-xl border shadow-sm">
                <div className="flex items-start space-x-4 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Copy className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">{questionPrompt}</h3>
                        {questionContext && (
                            <div className="mt-2 p-3 bg-muted rounded-md text-muted-foreground italic border-l-4 border-primary/40">
                                "{questionContext}"
                            </div>
                        )}
                    </div>
                </div>

                {/* Target Area (Sentence being built) */}
                <div className="min-h-[120px] p-4 bg-muted/30 rounded-lg border-2 border-dashed border-input flex flex-wrap gap-2 content-start transition-colors hover:border-primary/40 active:border-primary">
                    {selectedParts.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/50 select-none pointer-events-none">
                            Tap words below to build your sentence...
                        </div>
                    ) : (
                        selectedParts.map((part, idx) => (
                            <button
                                key={`selected-${idx}`}
                                onClick={() => handleRemovePart(part, idx)}
                                className="group flex items-center bg-primary text-primary-foreground px-3 py-2 rounded-md font-medium text-sm shadow-sm hover:bg-primary/90 transition-all animate-in fade-in zoom-in-95 duration-200"
                            >
                                {part}
                                <X className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))
                    )}
                </div>

                <div className="flex justify-end mt-2">
                    <button
                        onClick={handleReset}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center px-2 py-1 rounded hover:bg-muted transition-colors"
                        disabled={selectedParts.length === 0}
                    >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Reset Sentence
                    </button>
                </div>
            </div>

            {/* Source Area (Available words) */}
            <div className="bg-card p-6 rounded-xl border shadow-sm flex-1">
                <h4 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Available Parts</h4>
                <div className="flex flex-wrap gap-3">
                    {availableParts.map((part, idx) => (
                        <button
                            key={`available-${idx}`}
                            onClick={() => handleSelectPart(part, idx)}
                            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-base font-medium hover:bg-secondary/80 hover:scale-105 active:scale-95 transition-all shadow-sm border border-transparent hover:border-input"
                        >
                            {part}
                        </button>
                    ))}
                    {availableParts.length === 0 && (
                        <div className="w-full py-8 text-center text-muted-foreground italic">
                            All parts used. Review your sentence above.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
