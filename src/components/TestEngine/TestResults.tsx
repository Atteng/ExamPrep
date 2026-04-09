import { useState } from "react";
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Import all question renderers
import ListenChooseResponse from "@/components/questions/renderers/ListenChooseResponse";
import ListenConversation from "@/components/questions/renderers/ListenConversation";
import ListenAnnouncement from "@/components/questions/renderers/ListenAnnouncement";
import ListenAcademicTalk from "@/components/questions/renderers/ListenAcademicTalk";
import CompleteTheWords from "@/components/questions/renderers/CompleteTheWords";
import ListenRepeat from "@/components/questions/renderers/ListenRepeat";
import TakeInterview from "@/components/questions/renderers/TakeInterview";

interface GradedItem {
    questionId: string;
    section: string;
    taskType: string;
    score: number;
    feedback?: string;
    improvedVersion?: string; // New field for Writing tasks
    userAnswer: string;
    correctAnswer?: string;
    originalQuestion?: any;
    options?: string[];
}

interface TestResultsProps {
    totalScore: number;
    maxScore: number;
    sectionScores: { reading: number; listening: number; speaking: number; writing: number };
    gradedItems: GradedItem[];
    writingBreakdown?: any;
    onClose: () => void;
}

export function TestResults({ totalScore, maxScore, sectionScores, gradedItems, writingBreakdown, onClose }: TestResultsProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    if (!gradedItems || gradedItems.length === 0) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-background rounded-xl max-w-2xl w-full p-8">
                    <h2 className="text-2xl font-bold mb-4">No Results Available</h2>
                    <button onClick={onClose} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
                        Close
                    </button>
                </div>
            </div>
        );
    }

    const currentItem = gradedItems[currentIndex];
    const isCorrect = currentItem.score >= 80;

    const handleNext = () => {
        if (currentIndex < gradedItems.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const renderQuestion = () => {
        const question = currentItem.originalQuestion;

        if (!question) {
            return (
                <div className="p-8 text-center">
                    <p className="text-muted-foreground">Question data not available</p>
                    <div className="mt-4 space-y-2">
                        <p><strong>Your Answer:</strong> {currentItem.userAnswer}</p>
                        <p><strong>Correct Answer:</strong> {currentItem.correctAnswer}</p>
                    </div>
                </div>
            );
        }

        const taskType = (currentItem.taskType || question.taskType || "").toLowerCase();

        const commonProps = {
            question,
            onAnswer: () => { }, 
            reviewMode: true,
            userAnswer: currentItem.userAnswer,
            correctAnswer: currentItem.correctAnswer,
            aiFeedback: currentItem.feedback
        };

        if (taskType.includes("choose a response")) {
            return <ListenChooseResponse {...commonProps} />;
        } else if (taskType.includes("conversation")) {
            return <ListenConversation {...commonProps} />;
        } else if (taskType.includes("announcement")) {
            return <ListenAnnouncement {...commonProps} />;
        } else if (taskType.includes("academic talk") || taskType.includes("academic_talk")) {
            return <ListenAcademicTalk {...commonProps} />;
        } else if (taskType.includes("complete the words") || taskType.includes("complete the sentences")) {
            return <CompleteTheWords {...commonProps} />;
        } else if (taskType.includes("listen and repeat") || taskType.includes("repeat sentence")) {
            return <ListenRepeat {...commonProps} />;
        } else if (taskType.includes("interview") || taskType.includes("answer the interviewer")) {
            return <TakeInterview {...commonProps} />;
        }

        return (
            <div className="p-8 max-w-3xl mx-auto">
                <div className="bg-muted/30 p-6 rounded-xl border mb-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="uppercase text-xs bg-primary/10 px-2 py-1 rounded text-primary tracking-wide">
                            {currentItem.section}
                        </span>
                        {taskType}
                    </h3>
                    <p className="text-lg leading-relaxed whitespace-pre-wrap">{question.prompt || question.text || "No prompt available"}</p>
                    {question.text && !question.text.startsWith('http') && (
                        <div className="mt-4 p-4 bg-background rounded border text-sm text-muted-foreground">
                            {question.text}
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className={cn(
                        "p-4 rounded-lg border-2",
                        isCorrect ? "bg-green-50 border-green-500" : "bg-red-50 border-red-500"
                    )}>
                        <p className="font-bold text-sm uppercase mb-2 opacity-70">Your Answer:</p>
                        <p className="font-medium whitespace-pre-wrap">{currentItem.userAnswer}</p>
                    </div>

                    {currentItem.improvedVersion && (
                        <div className="p-4 bg-purple-50 border-2 border-purple-500 rounded-lg shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-5 h-5 text-purple-600" />
                                <p className="font-bold text-sm uppercase opacity-70 text-purple-700">TOEFL Standard Rewrite (Band 6):</p>
                            </div>
                            <div className="bg-white/70 p-4 rounded border border-purple-200 text-purple-900 leading-relaxed font-serif text-lg whitespace-pre-wrap italic">
                                "{currentItem.improvedVersion}"
                            </div>
                            <p className="mt-3 text-xs text-purple-600 font-medium italic">
                                Note: This version demonstrates higher-level vocabulary and more sophisticated sentence structures for the same content.
                            </p>
                        </div>
                    )}

                    {!isCorrect && currentItem.correctAnswer && !currentItem.improvedVersion && (
                        <div className="p-4 bg-green-50 border-2 border-green-500 rounded-lg">
                            <p className="font-bold text-sm uppercase mb-2 opacity-70 text-green-700">Correct Answer:</p>
                            <p className="font-medium text-green-800 whitespace-pre-wrap">{currentItem.correctAnswer}</p>
                        </div>
                    )}

                    {currentItem.feedback && (
                        <div className="p-4 bg-blue-50 border-2 border-blue-500 rounded-lg flex gap-3">
                            <div className="mt-1 flex-shrink-0">
                                <CheckCircle className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="font-bold text-sm uppercase mb-1 opacity-70 text-blue-700">Detailed Feedback:</p>
                                <p className="text-blue-800 leading-relaxed">{currentItem.feedback}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const percentage = Math.round((totalScore / maxScore) * 100);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-background rounded-xl max-w-5xl w-full max-h-[95vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
                    <div>
                        <h2 className="text-2xl font-bold">Session Review</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">
                                Question {currentIndex + 1} of {gradedItems.length}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                                {currentItem.section}
                            </span>
                        </div>
                        {writingBreakdown && (
                            <div className="mt-3 text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground">Writing breakdown:</span>{" "}
                                objective {writingBreakdown.objective?.band ?? "—"} (w={writingBreakdown.objective?.weight ?? "—"}),{" "}
                                rubric {writingBreakdown.rubric?.band ?? "—"} (w={writingBreakdown.rubric?.weight ?? "—"})
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                            <div className="text-3xl font-bold tracking-tight">{percentage}%</div>
                            <div className="text-sm text-muted-foreground mr-1">Section Score</div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-muted rounded-full transition-colors border border-transparent hover:border-border"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Score Badge */}
                <div className={cn(
                    "px-6 py-3 border-b flex items-center justify-center",
                    isCorrect ? "bg-green-50/50" : "bg-red-50/50"
                )}>
                    <div className="flex items-center gap-2">
                        {isCorrect ? (
                            <>
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <span className="font-bold text-green-700">Satisfactory Performance</span>
                            </>
                        ) : (
                            <>
                                <XCircle className="w-5 h-5 text-red-600" />
                                <span className="font-bold text-red-700">Needs Improvement</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Question Content - Scrollable */}
                <div className="flex-1 overflow-y-auto bg-muted/5 p-4 md:p-8">
                    {renderQuestion()}
                </div>

                {/* Navigation Footer */}
                <div className="p-6 border-t bg-background flex items-center justify-between shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
                    <button
                        onClick={handlePrevious}
                        disabled={currentIndex === 0}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all",
                            currentIndex === 0
                                ? "opacity-30 cursor-not-allowed text-muted-foreground"
                                : "hover:bg-muted text-foreground border border-border/50 shadow-sm"
                        )}
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Previous
                    </button>

                    <div className="flex items-center gap-1.5 hidden sm:flex">
                        {gradedItems.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={cn(
                                    "transition-all duration-300 rounded-full",
                                    idx === currentIndex
                                        ? "bg-primary w-8 h-2.5"
                                        : "bg-muted-foreground/20 w-2.5 h-2.5 hover:bg-muted-foreground/40"
                                )}
                            />
                        ))}
                    </div>

                    <button
                        onClick={currentIndex === gradedItems.length - 1 ? onClose : handleNext}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium shadow-md transition-all active:scale-95",
                            currentIndex === gradedItems.length - 1
                                ? "bg-zinc-800 text-white hover:bg-zinc-700" 
                                : "bg-primary text-primary-foreground hover:bg-primary/90" 
                        )}
                    >
                        {currentIndex === gradedItems.length - 1 ? "Finish Review" : "Next Question"}
                        {currentIndex < gradedItems.length - 1 && <ChevronRight className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
