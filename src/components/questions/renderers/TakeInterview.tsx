"use client";

import { useEffect, useState } from "react";
import { QuestionData } from "@/types/question";
import { QuestionContainer } from "../QuestionContainer";
import AudioRecorder from "@/components/audio/AudioRecorder";
import { speakText, stopSpeaking } from "@/lib/audio/tts";
import { uploadAudioResponse } from "@/lib/db/storage";
import { User, Mic, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface TakeInterviewProps {
    question: QuestionData;
    onAnswer: (answer: string) => void;
}

export default function TakeInterview({ question, onAnswer }: TakeInterviewProps) {
    const [status, setStatus] = useState<'idle' | 'listening' | 'recording' | 'completed'>('idle');
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

    // Unlike ListenRepeat, the text here is the QUESTION text from the interviewer.
    const interviewerQuestion = question.text;

    useEffect(() => {
        // Reset on new question
        setStatus('idle');
        setRecordedBlob(null);
        stopSpeaking();
    }, [question.id]);

    const startInterview = () => {
        setStatus('listening');
        speakText(interviewerQuestion || "No question text available.", () => {
            // Auto-start recording after question is asked? 
            // Better to let user click "Start Answer" to gather thoughts, 
            // OR follow strict exam mode (auto).
            // For now, let's auto-switch state to ready-to-record but wait for manual start 
            // to be user friendly, or just auto-start if we want hardcore.
            // Let's go with Manual Start for now, but UI indicates it's time.
            setStatus('recording');
        });
    };

    const handleStopRecording = async (blob: Blob, duration: number) => {
        setRecordedBlob(blob);
        setStatus('completed');

        // Upload to Storage
        const url = await uploadAudioResponse(blob, 'anonymous_user', 'toefl');

        if (url) {
            onAnswer(url);
        } else {
            alert("Failed to upload interview response.");
        }
    };

    return (
        <QuestionContainer question={question}>
            <div className="flex flex-col h-full min-h-[500px] max-w-4xl mx-auto">
                {/* Header / Context */}
                <div className="text-center mb-8 space-y-2">
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                        Speaking Interview
                    </span>
                    <h2 className="text-2xl font-bold">Answer the Interviewer</h2>
                    <p className="text-muted-foreground">
                        Listen to the question, then record your answer. You have 45 seconds.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center flex-1">

                    {/* Left: The Interviewer (Avatar) */}
                    <div className="flex flex-col items-center justify-center space-y-6">
                        <div className={cn(
                            "relative w-40 h-40 rounded-full flex items-center justify-center border-4 transition-all duration-500",
                            status === 'listening' ? "border-primary bg-primary/5 shadow-[0_0_30px_rgba(var(--primary),0.3)]" : "border-muted bg-muted/30"
                        )}>
                            <Monitor className={cn("w-16 h-16 text-muted-foreground", status === 'listening' && "text-primary animate-pulse")} />

                            {/* Speech Bubble Animation */}
                            {status === 'listening' && (
                                <div className="absolute -top-4 -right-4 bg-primary text-primary-foreground px-4 py-2 rounded-xl rounded-bl-none shadow-lg text-sm animate-bounce">
                                    Speaking...
                                </div>
                            )}
                        </div>

                        {status === 'idle' && (
                            <button
                                onClick={startInterview}
                                className="px-8 py-3 bg-primary text-primary-foreground rounded-full font-bold shadow-lg hover:bg-primary/90 hover:scale-105 transition-all"
                            >
                                Start Interview
                            </button>
                        )}

                        {/* Show text ONLY after listening or during if configured (Hidden for now to force listening) */}
                        <div className={cn(
                            "text-center p-4 rounded-lg bg-muted/20 border max-w-sm transition-all duration-700",
                            status === 'idle' ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
                        )}>
                            <p className="italic text-lg text-foreground/80">"{interviewerQuestion}"</p>
                        </div>
                    </div>

                    {/* Right: The You (Recorder) */}
                    <div className={cn(
                        "flex flex-col items-center justify-center transition-all duration-500",
                        status === 'idle' || status === 'listening' ? "opacity-30 grayscale blur-[1px]" : "opacity-100"
                    )}>
                        <div className="mb-4 flex items-center gap-2 text-muted-foreground">
                            <User className="w-5 h-5" />
                            <span className="font-medium">Your Response</span>
                        </div>

                        {/* Pointer Events disabled until it's time to record */}
                        <div className={cn(
                            "w-full",
                            (status === 'idle' || status === 'listening') && "pointer-events-none"
                        )}>
                            <AudioRecorder
                                onStop={handleStopRecording}
                                timeLimit={45}
                            />
                        </div>
                    </div>

                </div>
            </div>
        </QuestionContainer>
    );
}
