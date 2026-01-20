"use client";

import { useEffect, useState, useRef } from "react";
import { QuestionData } from "@/types/question";
import { QuestionContainer } from "../QuestionContainer";
import { speakText, stopSpeaking } from "@/lib/audio/tts";
import { uploadAudioResponse } from "@/lib/db/storage";
import { Monitor, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface TakeInterviewProps {
    question: QuestionData;
    onAnswer: (answer: string) => void;
}

type FlowState = 'initial' | 'playing' | 'waiting' | 'recording' | 'complete';

export default function TakeInterview({ question, onAnswer }: TakeInterviewProps) {
    const [flowState, setFlowState] = useState<FlowState>('initial');
    const [countdown, setCountdown] = useState(0);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const interviewerQuestion = question.text;
    const PREP_DELAY = 1; // 1 second after question
    const RECORDING_TIME = 45; // 45 seconds to answer

    useEffect(() => {
        // Auto-start flow on mount
        handleStartFlow();

        return () => {
            stopSpeaking();
            stopRecording();
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
        };
    }, [question.id]);

    const handleStartFlow = () => {
        setFlowState('playing');
        speakText(interviewerQuestion || "No question available.", () => {
            // Question finished, start prep delay
            setFlowState('waiting');
            setCountdown(PREP_DELAY);

            let remaining = PREP_DELAY;
            const interval = setInterval(() => {
                remaining--;
                setCountdown(remaining);

                if (remaining === 0) {
                    clearInterval(interval);
                    playBeep();
                    setTimeout(() => startRecording(), 200);
                }
            }, 1000);

            countdownIntervalRef.current = interval;
        });
    };

    const playBeep = () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.3;

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setRecordedBlob(blob);
                await handleUpload(blob);
            };

            mediaRecorder.start();
            setFlowState('recording');
            setCountdown(RECORDING_TIME);

            // Auto-stop countdown
            let remaining = RECORDING_TIME;
            const interval = setInterval(() => {
                remaining--;
                setCountdown(remaining);

                if (remaining === 0) {
                    clearInterval(interval);
                    stopRecording();
                }
            }, 1000);

            countdownIntervalRef.current = interval;

        } catch (error) {
            console.error("Microphone access denied:", error);
            alert("Microphone access is required for this task.");
            setFlowState('initial');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
    };

    const handleUpload = async (blob: Blob) => {
        setFlowState('complete');

        const url = await uploadAudioResponse(blob, 'anonymous_user', 'toefl');

        if (url) {
            console.log("Interview response uploaded:", url);
            onAnswer(url);
        } else {
            console.error("Upload failed");
            alert("Failed to upload interview response.");
        }
    };

    return (
        <QuestionContainer question={question}>
            <div className="flex flex-col min-h-[500px] max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8 space-y-2">
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                        Speaking Interview
                    </span>
                    <h2 className="text-2xl font-bold">Answer the Interviewer</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center flex-1">

                    {/* Left: Interviewer */}
                    <div className="flex flex-col items-center justify-center space-y-6">
                        <div className={cn(
                            "relative w-40 h-40 rounded-full flex items-center justify-center border-4 transition-all duration-500",
                            flowState === 'playing' ? "border-primary bg-primary/5 shadow-[0_0_30px_rgba(var(--primary),0.3)]" : "border-muted bg-muted/30"
                        )}>
                            <Monitor className={cn("w-16 h-16 text-muted-foreground", flowState === 'playing' && "text-primary animate-pulse")} />

                            {flowState === 'playing' && (
                                <div className="absolute -top-4 -right-4 bg-primary text-primary-foreground px-4 py-2 rounded-xl rounded-bl-none shadow-lg text-sm animate-bounce">
                                    Speaking...
                                </div>
                            )}
                        </div>

                        {/* Question Text (shows after playing starts) */}
                        <div className={cn(
                            "text-center p-6 rounded-lg bg-muted/20 border max-w-sm transition-all duration-700",
                            flowState === 'initial' ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
                        )}>
                            <p className="italic text-lg text-foreground/90">"{interviewerQuestion}"</p>
                        </div>
                    </div>

                    {/* Right: Status & Timer */}
                    <div className="flex flex-col items-center justify-center space-y-6">

                        {flowState === 'initial' && (
                            <>
                                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Monitor className="w-10 h-10 text-primary" />
                                </div>
                                <h3 className="text-xl font-medium">Preparing interview...</h3>
                            </>
                        )}

                        {flowState === 'playing' && (
                            <>
                                <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <Monitor className="w-12 h-12 text-blue-500 animate-pulse" />
                                </div>
                                <h3 className="text-xl font-medium">Listen to the question</h3>
                                <p className="text-sm text-muted-foreground">Recording will start automatically</p>
                            </>
                        )}

                        {flowState === 'waiting' && (
                            <>
                                <div className="w-24 h-24 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                    <span className="text-4xl font-bold text-yellow-600">{countdown}</span>
                                </div>
                                <h3 className="text-xl font-medium text-yellow-600">Get ready...</h3>
                                <p className="text-sm text-muted-foreground">Recording starts in {countdown} second{countdown !== 1 ? 's' : ''}</p>
                            </>
                        )}

                        {flowState === 'recording' && (
                            <>
                                <div className="w-32 h-32 rounded-full bg-red-500/20 flex items-center justify-center relative">
                                    <Mic className="w-16 h-16 text-red-500 animate-pulse" />
                                    <div className="absolute inset-0 rounded-full border-4 border-red-500/30 animate-ping"></div>
                                </div>
                                <h3 className="text-2xl font-bold text-red-500">Recording</h3>
                                <div className="text-5xl font-bold tabular-nums">{countdown}s</div>
                                <p className="text-sm text-muted-foreground">Give your answer</p>
                            </>
                        )}

                        {flowState === 'complete' && (
                            <>
                                <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <MicOff className="w-12 h-12 text-green-500" />
                                </div>
                                <h3 className="text-xl font-medium text-green-600">Response Recorded!</h3>
                                <p className="text-sm text-muted-foreground">Your answer has been submitted</p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </QuestionContainer>
    );
}
