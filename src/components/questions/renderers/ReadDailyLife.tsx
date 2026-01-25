"use client";

import { useState } from "react";
import { QuestionData } from "@/types/question";
import { QuestionContainer } from "../QuestionContainer";
import { MultipleChoice } from "../MultipleChoice";
import { extractQuestionContent, cleanText } from "@/lib/utils";

interface ReadDailyLifeProps {
    question: QuestionData;
    onAnswer: (answer: string | number) => void;
}

export default function ReadDailyLife({ question, onAnswer }: ReadDailyLifeProps) {
    const [selected, setSelected] = useState<string | number | null>(null);

    const handleSelect = (option: string | number) => {
        setSelected(option);
        onAnswer(option);
    };


    // Smart content renderer: detects JSON structure and formats accordingly
    const renderContent = () => {
        if (!question.text) return null;

        // Try to parse as JSON (for structured content like emails)
        try {
            let parsed = JSON.parse(question.text);

            // Handle array wrapper (AI sometimes returns [{ ... }])
            if (Array.isArray(parsed) && parsed.length > 0) {
                parsed = parsed[0];
            }

            // Handle structured email/notice format
            if (parsed.type && (parsed.content || parsed.body)) {
                return (
                    <div className="space-y-3">
                        {/* Type Badge */}
                        <div className="inline-flex items-center px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                            {parsed.type}
                        </div>

                        {/* Title (if exists) */}
                        {parsed.title && (
                            <h3 className="text-lg font-semibold text-foreground">
                                {parsed.title}
                            </h3>
                        )}

                        {/* Content */}
                        <div className="text-sm leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                            {cleanText(parsed.content || parsed.body)}
                        </div>
                    </div>
                );
            }
        } catch {
            // Not structured JSON, proceed to fallback
        }

        // Fallback: Use standardized extractor for generic JSON or plain text
        return cleanText(extractQuestionContent(question.text));
    };

    return (
        <QuestionContainer question={question}>
            <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                {/* Left Column: Reading Material */}
                <div className="bg-muted/30 p-4 md:p-6 rounded-lg border border-border/50">
                    <div
                        className="prose dark:prose-invert max-w-none text-sm md:text-base leading-relaxed"
                        style={{ whiteSpace: 'pre-wrap' }}
                    >
                        {renderContent()}
                    </div>
                </div>

                {/* Right Column: Question */}
                <div className="space-y-6">
                    <div className="font-medium text-foreground text-lg">
                        {question.prompt} {/* Sometimes the specific question is separate from prompt */}
                    </div>

                    {question.options && (
                        <MultipleChoice
                            options={question.options}
                            selectedOption={selected}
                            onSelect={handleSelect}
                        />
                    )}
                </div>
            </div>
        </QuestionContainer>
    );
}
