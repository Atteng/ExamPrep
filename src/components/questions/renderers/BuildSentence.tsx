"use client";


import { useState, useEffect } from "react";
import { QuestionData } from "@/types/question";
import { cn } from "@/lib/utils";
import { Copy, RefreshCw, X, MessageCircle } from "lucide-react";

interface BuildSentenceProps {
    question: QuestionData;
    onAnswer: (answer: string) => void;
}

export default function BuildSentence({ question, onAnswer }: BuildSentenceProps) {
    const { prompt, example, context } = question.structure || {};

    // Parse Context (Person A line)
    // Sometimes AI might include "Person A:" prefix, clean it for display
    let contextText = context || question.prompt || "";
    if (contextText.startsWith("Person A:")) contextText = contextText.replace("Person A:", "").trim();

    // Word Parts
    const scrambledParts: string[] = example?.scrambled_parts || question.options || [];

    // Main instructions for the task
    const instruction = "Make an appropriate sentence.";

    const [availableParts, setAvailableParts] = useState<string[]>([]);
    const [selectedParts, setSelectedParts] = useState<string[]>([]);

    useEffect(() => {
        setAvailableParts(scrambledParts);
        setSelectedParts([]);
        onAnswer("");
    }, [question.id]);

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

            {/* Header / Instruction */}
            <div className="flex items-center gap-2 text-muted-foreground bg-muted/30 p-3 rounded-lg border">
                <Copy className="w-5 h-5" />
                <span className="font-medium">{instruction}</span>
            </div>

            {/* Conversation Area */}
            <div className="space-y-6 bg-card p-6 rounded-xl border shadow-sm">

                {/* Person A (Context) */}
                <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-700 font-bold text-sm">
                        A
                    </div>
                    <div className="bg-muted p-4 rounded-2xl rounded-tl-none max-w-[85%] text-lg">
                        {contextText}
                    </div>
                </div>

                {/* Person B (You) - Target Area */}
                <div className="flex gap-4 flex-row-reverse">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-sm">
                        You
                    </div>
                    <div className="bg-primary/5 p-4 rounded-2xl rounded-tr-none w-full border-2 border-dashed border-primary/20 hover:border-primary/50 transition-colors min-h-[100px] flex flex-wrap gap-2 items-center">

                        {/* Selected Words */}
                        {selectedParts.length > 0 ? (
                            selectedParts.map((part, idx) => (
                                <button
                                    key={`selected-${idx}`}
                                    onClick={() => handleRemovePart(part, idx)}
                                    className="group flex items-center bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-medium text-base shadow-sm hover:bg-primary/90 transition-all animate-in fade-in zoom-in-95"
                                >
                                    {part}
                                    <X className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))
                        ) : (
                            <span className="text-muted-foreground/50 italic select-none">
                                Tap words below to build your reply...
                            </span>
                        )}

                        {/* Reset Button (Small, inline if needed, or keeping explicit below) */}
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleReset}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 hover:bg-muted px-2 py-1 rounded"
                        disabled={selectedParts.length === 0}
                    >
                        <RefreshCw className="w-3 h-3" />
                        Reset Reply
                    </button>
                </div>

            </div>

            {/* Word Bank */}
            <div className="bg-card p-6 rounded-xl border shadow-sm mt-auto">
                <h4 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Available Words
                </h4>
                <div className="flex flex-wrap gap-3 justify-center">
                    {availableParts.map((part, idx) => (
                        <button
                            key={`available-${idx}`}
                            onClick={() => handleSelectPart(part, idx)}
                            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-lg font-medium hover:bg-secondary/80 hover:-translate-y-0.5 transition-all shadow-sm border border-transparent hover:border-input/50"
                        >
                            {part}
                        </button>
                    ))}
                    {availableParts.length === 0 && (
                        <div className="text-muted-foreground italic text-sm">
                            All words used.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
