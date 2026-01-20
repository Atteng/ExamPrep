import { CheckCircle, XCircle, AlertCircle, Award, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GradedItem {
    questionId: string;
    section: string;
    taskType: string;
    score: number; // 0-100 normalized
    feedback?: string;
    details?: {
        strength?: string;
        weakness?: string;
        score?: number; // Raw score
        maxScore?: number;
    };
    userAnswer: string;
}

interface TestResultsProps {
    totalScore: number;
    maxScore: number;
    sectionScores: { reading: number; listening: number; speaking: number; writing: number };
    gradedItems: GradedItem[];
    onClose: () => void;
}

export function TestResults({ totalScore, maxScore, sectionScores, gradedItems, onClose }: TestResultsProps) {
    // Group Feedback by Section
    const feedbackItems = gradedItems.filter(i => i.feedback || i.details?.strength);

    return (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border shadow-2xl flex flex-col">

                {/* Header */}
                <div className="p-6 border-b flex items-center justify-between bg-muted/20">
                    <div>
                        <h2 className="text-2xl font-bold">Test Results</h2>
                        <p className="text-muted-foreground">Here is how you performed.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-sm text-muted-foreground font-medium">Total Score</div>
                            <div className="text-3xl font-bold text-primary">{totalScore} <span className="text-lg text-muted-foreground">/ {maxScore}</span></div>
                        </div>
                        <Award className="w-10 h-10 text-primary" />
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-8 flex-1">

                    {/* Section Breakdown */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(sectionScores).map(([section, score]) => (
                            <div key={section} className="p-4 rounded-lg bg-muted/50 border flex flex-col items-center justify-center text-center">
                                <div className="text-muted-foreground capitalize text-sm font-medium mb-1">{section}</div>
                                <div className="text-2xl font-bold">{score} <span className="text-xs text-muted-foreground">/ 30</span></div>
                            </div>
                        ))}
                    </div>

                    {/* Detailed Feedback List */}
                    {feedbackItems.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <AlertCircle className="w-5 h-5" />
                                AI Feedback & Analysis
                            </h3>
                            <div className="space-y-4">
                                {feedbackItems.map((item, idx) => (
                                    <div key={idx} className="border rounded-lg p-5 space-y-3 bg-card">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="uppercase text-xs font-bold px-2 py-1 rounded bg-primary/10 text-primary">
                                                    {item.section}
                                                </span>
                                                <span className="font-medium text-sm text-muted-foreground">
                                                    {item.taskType}
                                                </span>
                                            </div>
                                            {item.details && (
                                                <span className="font-bold text-sm">
                                                    Score: {item.details.score}/{item.details.maxScore}
                                                </span>
                                            )}
                                        </div>

                                        {/* Feedback Text */}
                                        {item.feedback && (
                                            <p className="text-sm italic border-l-2 border-primary/50 pl-3">
                                                "{item.feedback}"
                                            </p>
                                        )}

                                        {/* Strength / Weakness */}
                                        {item.details && (
                                            <div className="grid md:grid-cols-2 gap-4 text-sm pt-2">
                                                {item.details.strength && (
                                                    <div className="flex gap-2 text-green-700 bg-green-50 p-2 rounded">
                                                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <span className="font-semibold block">Strength</span>
                                                            {item.details.strength}
                                                        </div>
                                                    </div>
                                                )}
                                                {item.details.weakness && (
                                                    <div className="flex gap-2 text-red-700 bg-red-50 p-2 rounded">
                                                        <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <span className="font-semibold block">Improvement Area</span>
                                                            {item.details.weakness}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Fallback for general feedback if no specific strength/weakness */}
                                                {!item.details.strength && !item.details.weakness && item.feedback && (
                                                    <div className="col-span-2 text-muted-foreground">
                                                        {item.feedback}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {feedbackItems.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>No detailed feedback available for this test session.</p>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-muted/20 flex justify-end">
                    <button
                        onClick={onClose}
                        className="flex items-center px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
                    >
                        Return to Dashboard
                        <ArrowRight className="ml-2 w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
