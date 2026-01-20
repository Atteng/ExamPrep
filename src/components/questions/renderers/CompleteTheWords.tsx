"use client";

import { useState, useEffect } from "react";
import { QuestionData } from "@/types/question";
import { QuestionContainer } from "../QuestionContainer";

interface CompleteTheWordsProps {
    question: QuestionData;
    onAnswer: (answer: string | number) => void;
}

export default function CompleteTheWords({ question, onAnswer }: CompleteTheWordsProps) {
    const [inputs, setInputs] = useState<{ [key: number]: string }>({});

    // Parse the text to find blanks (format: "word_ _ _")
    const parseText = () => {
        if (!question.text) return [];

        let rawText = question.text;

        // Try to unwrap JSON if the AI returned a structured object
        try {
            const trimmed = rawText.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                const parsed = JSON.parse(rawText);

                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Handle array response check for first item
                    if (parsed[0]?.paragraph) rawText = parsed[0].paragraph;
                    else if (parsed[0]?.text) rawText = parsed[0].text;
                } else {
                    // Handle object response
                    if (parsed.paragraph) rawText = parsed.paragraph;
                    else if (parsed.text) rawText = parsed.text;
                    else if (parsed.content) rawText = parsed.content;
                }
            }
        } catch (e) {
            // Not JSON, continue with raw text
        }

        const parts: { type: 'text' | 'blank', content: string, index?: number }[] = [];
        const regex = /(\w+)(_ _ _)/g;
        let lastIndex = 0;
        let blankIndex = 0;

        rawText.replace(regex, (match, prefix, blanks, offset) => {
            // Add text before the blank
            if (offset > lastIndex) {
                parts.push({ type: 'text', content: rawText.slice(lastIndex, offset) });
            }

            // Add the visible prefix
            parts.push({ type: 'text', content: prefix });

            // Add the blank input
            parts.push({ type: 'blank', content: '', index: blankIndex });
            blankIndex++;

            lastIndex = offset + match.length;
            return match;
        });

        // Add remaining text
        if (lastIndex < rawText.length) {
            parts.push({ type: 'text', content: rawText.slice(lastIndex) });
        }

        return parts;
    };

    const parts = parseText();
    const blankCount = parts.filter(p => p.type === 'blank').length;

    // Parse answers to get lengths for placeholders
    const answerLengths: number[] = [];
    if (question.answerKey) {
        const matches = Array.from(String(question.answerKey).matchAll(/\(\d+\)\s*(\w+)/g));
        for (const match of matches) {
            answerLengths.push(match[1].length);
        }
    }

    // Update answer when inputs change
    useEffect(() => {
        // Combine all inputs into a single answer string
        const answers = Object.keys(inputs)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(key => inputs[parseInt(key)] || '')
            .join(',');

        onAnswer(answers);
    }, [inputs, onAnswer]);

    const handleInputChange = (index: number, value: string) => {
        setInputs(prev => ({ ...prev, [index]: value }));
    };

    return (
        <QuestionContainer question={question}>
            <div className="space-y-6">
                {/* Instructions */}
                <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                    <p className="text-sm text-muted-foreground">
                        Complete the missing letters in each word below. The number of dots indicates the number of missing letters.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                        {blankCount} word{blankCount !== 1 ? 's' : ''} to complete
                    </p>
                </div>

                {/* Passage with inline inputs */}
                <div className="bg-background p-6 rounded-lg border border-border/50">
                    <div className="text-base leading-relaxed">
                        {parts.map((part, idx) => {
                            if (part.type === 'text') {
                                return <span key={idx}>{part.content}</span>;
                            } else if (part.type === 'blank' && part.index !== undefined) {
                                const expectedLength = answerLengths[part.index] || 3;
                                const placeholder = '•'.repeat(expectedLength);

                                return (
                                    <input
                                        key={idx}
                                        type="text"
                                        value={inputs[part.index] || ''}
                                        onChange={(e) => handleInputChange(part.index!, e.target.value)}
                                        className="inline-block px-1 mx-0.5 text-center border-b-2 border-primary bg-transparent focus:outline-none focus:border-primary/80 transition-colors text-primary font-medium"
                                        style={{ width: `${Math.max(2, expectedLength) * 0.8}em` }}
                                        placeholder={placeholder}
                                        maxLength={expectedLength + 2}
                                    />
                                );
                            }
                            return null;
                        })}
                    </div>
                </div>
            </div>
        </QuestionContainer>
    );
}
