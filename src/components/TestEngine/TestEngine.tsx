"use client";

import { useEffect } from "react";
import { useTestSession } from "@/hooks/useTestSession";
import { QuestionData } from "@/types/question";

import { Clock, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Renderers
import ReadDailyLife from "@/components/questions/renderers/ReadDailyLife";
import CompleteTheWords from "@/components/questions/renderers/CompleteTheWords";
import ReadAcademic from "@/components/questions/renderers/ReadAcademic";
import ListenRepeat from "@/components/questions/renderers/ListenRepeat";
import TakeInterview from "@/components/questions/renderers/TakeInterview";
import ListenConversation from "@/components/questions/renderers/ListenConversation";
import ListenAnnouncement from "@/components/questions/renderers/ListenAnnouncement";
import ListenAcademicTalk from "@/components/questions/renderers/ListenAcademicTalk";
import BuildSentence from "@/components/questions/renderers/BuildSentence";
import WriteEmail from "@/components/questions/renderers/WriteEmail";
import WriteAcademicDiscussion from "@/components/questions/renderers/WriteAcademicDiscussion";

interface TestEngineProps {
    questions: QuestionData[];
    timeLimit: number;
    title: string;
    onExit: () => void;
    onComplete?: (results: any) => void;
    examType?: string; // e.g., 'toefl'
    section?: string; // e.g., 'reading', 'listening', 'speaking'
}

export function TestEngine({ questions, timeLimit, title, onExit, onComplete, examType, section }: TestEngineProps) {
    const {
        currentIndex,
        currentQuestion,
        totalQuestions,
        timeLeft,
        isCompleted,
        currentAnswer,
        currentModule,
        isLoadingModule2,
        canGoBack,
        submitAnswer,
        nextQuestion,
        prevQuestion,
        startTest
    } = useTestSession({
        questions,
        timeLimit,
        examType,
        section,
        onComplete: (results) => {
            console.log("Test Completed", results);
            if (onComplete) onComplete(results);
        }
    });

    // Auto-start on mount
    useEffect(() => {
        startTest();
    }, [startTest]);

    // Format Time (MM:SS)
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (isCompleted) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-card border rounded-xl shadow-sm h-full min-h-[400px]">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Section Completed!</h2>
                <p className="text-muted-foreground mb-6">Your answers have been saved.</p>
                <button
                    onClick={onExit}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-md font-medium"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    // Renderer Selection Logic
    const renderQuestion = () => {
        const taskType = currentQuestion.taskType;

        // Map task types to renderers
        switch (taskType) {
            case 'Complete The Words':
            case 'complete_words':
                return (
                    <CompleteTheWords
                        question={currentQuestion}
                        onAnswer={submitAnswer}
                    />
                );

            case 'Read in Daily Life':
            case 'read_daily':
                return (
                    <ReadDailyLife
                        question={currentQuestion}
                        onAnswer={submitAnswer}
                    />
                );

            case 'Read an Academic Passage':
            case 'read_academic':
            case 'reading_passage_long': // From generator
                return (
                    <ReadAcademic
                        question={currentQuestion}
                        onAnswer={submitAnswer}
                    />
                );

            // --- SPEAKING ---
            case 'Listen and Repeat':
            case 'speaking_repeat':
                return (
                    <ListenRepeat
                        question={currentQuestion}
                        onAnswer={submitAnswer}
                    />
                );

            case 'Take an Interview':
            case 'speaking_interview':
                return (
                    <TakeInterview
                        question={currentQuestion}
                        onAnswer={submitAnswer}
                    />
                );

            // --- LISTENING ---
            case 'Listen to a Conversation':
            case 'listening_conversation':
                return (
                    <ListenConversation
                        question={currentQuestion}
                        onAnswer={submitAnswer}
                    />
                );

            case 'Listen to an Announcement':
            case 'listening_announcement':
                return (
                    <ListenAnnouncement
                        question={currentQuestion}
                        onAnswer={submitAnswer}
                    />
                );

            case 'Listen to an Academic Talk':
            case 'listening_academic_talk':
                return (
                    <ListenAcademicTalk
                        question={currentQuestion}
                        onAnswer={submitAnswer}
                    />
                );

            // --- WRITING ---
            case 'Build a Sentence':
            case 'build_sentence':
                return (
                    <BuildSentence
                        question={currentQuestion}
                        onAnswer={submitAnswer}
                    />
                );

            case 'Write an Email':
            case 'write_email':
                return (
                    <WriteEmail
                        question={currentQuestion}
                        onAnswer={submitAnswer}
                    />
                );

            case 'Write for an Academic Discussion':
            case 'academic_discussion':
                return (
                    <WriteAcademicDiscussion
                        question={currentQuestion}
                        onAnswer={submitAnswer}
                    />
                );

            // Fallback: Use ReadDailyLife for unknown reading types
            default:
                console.warn(`No renderer found for taskType: ${taskType}, using ReadDailyLife`);
                return (
                    <ReadDailyLife
                        question={currentQuestion}
                        onAnswer={submitAnswer}
                    />
                );
        }
    };

    return (
        <div className="flex flex-col h-full bg-background md:rounded-xl md:border md:shadow-sm overflow-hidden">
            {/* Test Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
                <div className="flex items-center space-x-4">
                    <span className="font-semibold text-sm md:text-base">{title}</span>
                    <span className="hidden md:inline-flex text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                        Question {currentIndex + 1} of {totalQuestions}
                    </span>
                </div>

                <div className="flex items-center space-x-3 text-sm font-variant-numeric tabular-nums">
                    <Clock className={cn(
                        "w-5 h-5",
                        timeLeft < 300 ? "text-red-500" : timeLeft < 600 ? "text-yellow-500" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                        "text-lg font-bold",
                        timeLeft < 300 && "text-red-500 animate-pulse",
                        timeLeft >= 300 && timeLeft < 600 && "text-yellow-600",
                        timeLeft >= 600 && "text-foreground"
                    )}>
                        {formatTime(timeLeft)}
                    </span>
                    {timeLeft < 300 && (
                        <span className="text-xs text-red-500 font-medium">
                            {timeLeft < 60 ? "FINAL MINUTE!" : "< 5 MIN"}
                        </span>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1 w-full bg-muted">
                <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.round(((currentIndex + 1) / totalQuestions) * 100)}%` }}
                />
            </div>

            {/* Active Question Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {isLoadingModule2 ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        <div className="text-center">
                            <h3 className="text-lg font-semibold mb-2">Module 1 Complete!</h3>
                            <p className="text-sm text-muted-foreground">Loading Module {currentModule}...</p>
                        </div>
                    </div>
                ) : (
                    renderQuestion()
                )}
            </div>

            {/* Footer / Controls */}
            <div className="flex items-center justify-between px-4 py-4 border-t bg-background">
                <button
                    onClick={prevQuestion}
                    disabled={!canGoBack || section === 'listening' || section === 'speaking'}
                    className="flex items-center px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                </button>

                <button
                    onClick={nextQuestion}
                    className="flex items-center px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                >
                    {currentIndex === totalQuestions - 1 ? "Finish" : "Next"}
                    {currentIndex !== totalQuestions - 1 && <ChevronRight className="w-4 h-4 ml-2" />}
                </button>
            </div>
        </div>
    );
}
