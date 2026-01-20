"use client";

import { useState, useEffect } from "react";
import { QuestionData } from "@/types/question";
import { Mail, User, Info } from "lucide-react";

interface WriteEmailProps {
    question: QuestionData;
    onAnswer: (answer: string) => void;
}

export default function WriteEmail({ question, onAnswer }: WriteEmailProps) {
    const { task, scenario, recipient, subject } = question.structure || {};
    // Fallback
    const taskDescription = task || question.prompt || "Write an email based on the scenario.";
    const scenarioText = scenario || question.context || "";
    const emailRecipient = recipient || "Recipient";
    const emailSubject = subject || "Subject";

    const [response, setResponse] = useState("");
    const wordCount = response.trim().split(/\s+/).filter(w => w.length > 0).length;

    useEffect(() => {
        // Reset on new question
        setResponse("");
        onAnswer("");
    }, [question.id]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setResponse(text);
        onAnswer(text);
    };

    return (
        <div className="flex flex-col lg:flex-row h-full gap-6 max-w-6xl mx-auto">
            {/* Left Column: Scenario & Instructions */}
            <div className="lg:w-1/2 flex flex-col space-y-6 overflow-y-auto pr-2">
                <div className="bg-card p-6 rounded-xl border shadow-sm">
                    <div className="flex items-center space-x-3 mb-4 text-primary">
                        <Info className="w-5 h-5" />
                        <h3 className="font-semibold text-lg">Scenario</h3>
                    </div>
                    <p className="text-foreground/90 leading-relaxed text-lg">
                        {scenarioText}
                    </p>
                </div>

                <div className="bg-muted/50 p-6 rounded-xl border border-dashed border-muted-foreground/30">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center">
                        <Mail className="w-4 h-4 mr-2" />
                        Task
                    </h4>
                    <p className="text-muted-foreground leading-relaxed">
                        {taskDescription}
                    </p>
                </div>
            </div>

            {/* Right Column: Email Editor */}
            <div className="lg:w-1/2 flex flex-col h-full bg-card rounded-xl border shadow-sm overflow-hidden">
                {/* Email Header Info */}
                <div className="bg-muted/30 p-4 border-b space-y-2 text-sm">
                    <div className="flex items-center text-muted-foreground">
                        <span className="w-16 font-medium text-foreground">To:</span>
                        <span className="bg-background px-2 py-0.5 rounded border text-foreground/80">{emailRecipient}</span>
                    </div>
                    <div className="flex items-center text-muted-foreground">
                        <span className="w-16 font-medium text-foreground">Subject:</span>
                        <span className="font-medium text-foreground">{emailSubject}</span>
                    </div>
                </div>

                {/* Text Area */}
                <textarea
                    className="flex-1 w-full p-6 bg-background resize-none focus:outline-none text-lg leading-relaxed font-serif"
                    placeholder="Type your email here..."
                    value={response}
                    onChange={handleChange}
                    spellCheck={false} // Valid simulation often disables spellcheck, though modern browser often force it.
                />

                {/* Footer / Stats */}
                <div className="bg-muted/30 p-3 border-t flex justify-between items-center text-xs text-muted-foreground font-medium">
                    <div>
                        <span className="hidden sm:inline">Make sure to address the prompts fully.</span>
                    </div>
                    <div className="bg-background px-3 py-1 rounded-full border shadow-sm">
                        Word Count: <span className="text-primary">{wordCount}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
