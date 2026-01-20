"use client";

import { useState, useEffect } from "react";
import { QuestionData } from "@/types/question";
import { MessageSquare, User, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface WriteAcademicDiscussionProps {
    question: QuestionData;
    onAnswer: (answer: string) => void;
}

export default function WriteAcademicDiscussion({ question, onAnswer }: WriteAcademicDiscussionProps) {
    const { professor_post, student_posts } = question.structure?.example || question.structure || {};

    // Fallback logic in case structure varies slightly
    const professorText = professor_post || question.prompt || "Discussion prompt missing.";
    const students = student_posts || [];

    const [response, setResponse] = useState("");
    const wordCount = response.trim().split(/\s+/).filter(w => w.length > 0).length;

    useEffect(() => {
        setResponse("");
        onAnswer("");
    }, [question.id]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setResponse(text);
        onAnswer(text);
    };

    return (
        <div className="flex flex-col lg:flex-row h-full gap-6 max-w-7xl mx-auto">
            {/* Left Column: Discussion Thread */}
            <div className="lg:w-1/2 flex flex-col space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                <div className="bg-card p-6 rounded-xl border shadow-sm">
                    <div className="flex items-center space-x-3 mb-4 text-primary">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <GraduationCap className="w-6 h-6" />
                        </div>
                        <h3 className="font-semibold text-lg text-foreground">Professor</h3>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-lg border-l-4 border-primary/50 text-foreground/90 leading-relaxed">
                        {professorText}
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2">Student Responses</h4>
                    {students.map((student: any, idx: number) => (
                        <div key={idx} className="bg-card p-5 rounded-xl border shadow-sm flex flex-col sm:flex-row gap-4">
                            <div className="flex-shrink-0 flex sm:flex-col items-center sm:w-16 space-x-3 sm:space-x-0 sm:space-y-2">
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm",
                                    idx % 2 === 0 ? "bg-blue-500" : "bg-orange-500"
                                )}>
                                    {student.name ? student.name.charAt(0) : "S"}
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">{student.name || `Student ${idx + 1}`}</span>
                            </div>
                            <div className="flex-1 bg-muted/20 p-3 rounded-lg text-sm leading-relaxed text-foreground/80">
                                {student.content}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Column: Your Contribution */}
            <div className="lg:w-1/2 flex flex-col h-full bg-card rounded-xl border shadow-sm overflow-hidden border-t-4 border-t-primary">
                <div className="p-4 border-b bg-muted/10 flex items-center justify-between">
                    <h3 className="font-semibold flex items-center">
                        <MessageSquare className="w-4 h-4 mr-2 text-primary" />
                        Your Contribution
                    </h3>
                    <div className="text-xs font-medium bg-background px-2 py-1 rounded border">
                        Target: 100+ words
                    </div>
                </div>

                <textarea
                    className="flex-1 w-full p-6 bg-background resize-none focus:outline-none text-lg leading-relaxed font-sans"
                    placeholder="Enter your response here. Contribute to the discussion by stating your opinion and supporting it..."
                    value={response}
                    onChange={handleChange}
                    spellCheck={true}
                />

                {/* Footer */}
                <div className="bg-muted/30 p-3 border-t flex justify-between items-center text-xs text-muted-foreground font-medium">
                    <div>
                        <span className="hidden sm:inline">Express and support your opinion clearly.</span>
                    </div>
                    <div className="bg-background px-3 py-1 rounded-full border shadow-sm flex items-center">
                        Word Count: <span className={cn("ml-1 font-bold", wordCount < 100 ? "text-orange-500" : "text-green-600")}>{wordCount}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
