"use client";

import { useState } from "react";
import { QuestionData } from "@/types/question";
import { QuestionContainer } from "../QuestionContainer";
import { extractQuestionContent } from "@/lib/utils";

interface ReadAcademicProps {
    question: QuestionData;
    onAnswer: (answer: string | number) => void;
}

export default function ReadAcademic({ question, onAnswer }: ReadAcademicProps) {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    const handleOptionSelect = (option: string) => {
        setSelectedOption(option);
        onAnswer(option);
    };

    // Helper to process newlines for display
    const renderParagraphs = (text: string) => {
        return text.split(/\n/).map((line, i) => (
            line.trim() ? <p key={i} className="mb-4 text-justify">{line.trim()}</p> : <br key={i} />
        ));
    };

    // Helper to render content using standardized extractor
    const renderContent = () => {
        const contentToRender = extractQuestionContent(question.text);

        if (!contentToRender) return null;

        return (
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-foreground/90 leading-relaxed font-serif">
                {renderParagraphs(contentToRender)}
            </div>
        );
    };

    return (
        <QuestionContainer question={question} className="max-w-7xl mx-auto w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-[500px]">

                {/* Left Column: Reading Passage (Scrollable) */}
                <div className="bg-card border rounded-lg shadow-sm flex flex-col h-[calc(100vh-16rem)] lg:h-[600px]">
                    <div className="p-4 border-b bg-muted/30">
                        <h3 className="font-semibold flex items-center gap-2">
                            <span>📖 Reading Passage</span>
                            <span className="text-xs font-normal text-muted-foreground ml-auto bg-background px-2 py-1 rounded border">
                                Scroll to read full text
                            </span>
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {renderContent()}
                    </div>
                </div>

                {/* Right Column: Question & Options */}
                <div className="flex flex-col h-full space-y-6">
                    <div className="bg-background rounded-lg p-1">
                        {/* Question Prompt */}
                        <h2 className="text-xl font-medium mb-6 leading-relaxed">
                            {question.prompt}
                        </h2>

                        {/* Options */}
                        <div className="space-y-3">
                            {question.options?.map((option, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleOptionSelect(option)}
                                    className={`w-full text-left p-4 rounded-lg border transition-all duration-200 group relative
                                        ${selectedOption === option
                                            ? 'border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(var(--primary))]'
                                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-medium transition-colors
                                            ${selectedOption === option
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-muted-foreground/30 text-muted-foreground group-hover:border-primary/50'
                                            }`}>
                                            {String.fromCharCode(65 + idx)}
                                        </div>
                                        <span className="text-sm md:text-base pt-0.5">{option}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </QuestionContainer>
    );
}
