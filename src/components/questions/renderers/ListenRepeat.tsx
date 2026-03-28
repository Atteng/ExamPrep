"use client";

import { useEffect, useState, useRef } from "react";
import { QuestionData } from "@/types/question";
import { QuestionContainer } from "../QuestionContainer";
import { speakText, stopSpeaking } from "@/lib/audio/tts";
import { uploadAudioResponse } from "@/lib/db/storage";
import { supabase } from "@/lib/supabase";
import { PlayCircle, Mic, MicOff, Play, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIFeedbackTooltip } from "@/components/ui/AIFeedbackTooltip";

interface ListenRepeatProps {
    question: QuestionData;
    onAnswer: (answer: string) => void;
    reviewMode?: boolean;
    userAnswer?: string;
    correctAnswer?: string;
    aiFeedback?: string;
}

type FlowState = 'initial' | 'playing' | 'waiting' | 'recording' | 'complete' | 'review';

export default function ListenRepeat({
    question,
    onAnswer,
    reviewMode = false,
    userAnswer = "",
    correctAnswer = "",
    aiFeedback = ""
}: ListenRepeatProps) {
    const [flowState, setFlowState] = useState<FlowState>(reviewMode ? 'review' : 'initial');
    const [countdown, setCountdown] = useState(0);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    const sentenceToRepeat = question.text || question.prompt || "No text available";
    const PREP_DELAY = 0; // Practice test says no prep time is provided
    const RECORDING_TIME = 12; // Overview: 8 to 12 seconds per response

    useEffect(() => {
        if (!reviewMode) {
            handleStartFlow();
        }

        return () => {
            stopSpeaking();
            stopRecording();
        };
    }, [question.id, reviewMode]);

    const handleStartFlow = () => {
        setFlowState('playing');
        speakText(sentenceToRepeat, () => {
            if (PREP_DELAY <= 0) {
                playBeep();
                setTimeout(() => startRecording(), 200);
                return;
            }

            setFlowState('waiting');
            setCountdown(PREP_DELAY);

            let remaining = PREP_DELAY;
            const interval = setInterval(() => {
                remaining--;
                setCountdown(remaining);

                if (remaining === 0) {
                    clearInterval(interval);
                    playBeep();
                    setTimeout(() => startRecording(), 200); // Start after beep
                }
            }, 1000);
        });
    };

    const handleReplayPrompt = () => {
        speakText(sentenceToRepeat);
    };

    const playBeep = () => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800; // 800 Hz beep
            gainNode.gain.value = 0.3;

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1); // 100ms beep
        } catch (e) {
            console.error("Audio context failed", e);
        }
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

            let remaining = RECORDING_TIME;
            const interval = setInterval(() => {
                // Check if still recording (user might have navigated away)
                if (mediaRecorderRef.current?.state === 'inactive') {
                    clearInterval(interval);
                    return;
                }

                remaining--;
                setCountdown(remaining);

                if (remaining === 0) {
                    clearInterval(interval);
                    stopRecording();
                }
            }, 1000);

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
        const { data: { user } } = await supabase.auth.getUser();
        const url = await uploadAudioResponse(blob, user?.id || 'anonymous_user', 'toefl');

        if (url) {
            onAnswer(url);
        } else {
            console.error("Upload failed");
            // alert("Failed to upload audio. Please try again.");
        }
    };

    // Derived correctness (very rough check if we have confidence, otherwise use feedback)
    // For ListenRepeat, it's hard to judge correctness client-side without transcription.
    // relying on aiFeedback tooltip
    const isCorrect = aiFeedback && !aiFeedback.toLowerCase().includes("incorrect") && !aiFeedback.toLowerCase().includes("improvement");

    return (
        <QuestionContainer question={question} hideHeader={true}>
            <div className="flex flex-col items-center justify-center space-y-8 min-h-[400px] w-full max-w-2xl mx-auto">

                {/* Header / Review Info */}
                <div className="text-center w-full">
                    {reviewMode && (
                        <div className="mb-6 flex items-center justify-center gap-2">
                            <h2 className="text-2xl font-bold">Repeat Sentence</h2>
                            {aiFeedback && <AIFeedbackTooltip feedback={aiFeedback} />}
                        </div>
                    )}
                </div>

                {/* Status Display */}
                <div className="text-center space-y-4 w-full">
                    {flowState === 'initial' && !reviewMode && (
                        <>
                            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                                <PlayCircle className="w-10 h-10 text-primary" />
                            </div>
                            <h3 className="text-xl font-medium">Preparing...</h3>
                        </>
                    )}

                    {flowState === 'playing' && (
                        <>
                            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                                <PlayCircle className="w-10 h-10 text-primary animate-pulse" />
                            </div>
                            <h3 className="text-xl font-medium">Listen carefully...</h3>
                        </>
                    )}

                    {flowState === 'waiting' && (
                        <>
                            <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto">
                                <span className="text-3xl font-bold text-yellow-600">{countdown}</span>
                            </div>
                            <h3 className="text-xl font-medium">Get ready...</h3>
                        </>
                    )}

                    {flowState === 'recording' && (
                        <>
                            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                                <Mic className="w-10 h-10 text-red-500 animate-pulse" />
                            </div>
                            <h3 className="text-xl font-medium text-red-500">Recording...</h3>
                            <div className="text-3xl font-bold">{countdown}s</div>
                        </>
                    )}

                    {(flowState === 'complete' || flowState === 'review') && (
                        <div className="space-y-6 w-full">
                            {!reviewMode ? (
                                <>
                                    <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                                        <MicOff className="w-10 h-10 text-green-500" />
                                    </div>
                                    <h3 className="text-xl font-medium text-green-600">Complete!</h3>
                                </>
                            ) : (
                                <div className="space-y-6 w-full text-left">
                                    {/* Original Sentence */}
                                    <div className="p-4 bg-muted/30 rounded-lg border">
                                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Original Sentence</h4>
                                        <p className="text-lg font-medium">{sentenceToRepeat}</p>
                                        <button
                                            onClick={handleReplayPrompt}
                                            className="mt-3 flex items-center gap-2 text-primary hover:underline text-sm"
                                        >
                                            <PlayCircle className="w-4 h-4" /> Replay Original Audio
                                        </button>
                                    </div>

                                    {/* User Recording */}
                                    <div className={cn(
                                        "p-4 rounded-lg border-2",
                                        isCorrect ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                                    )}>
                                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-2">
                                            Your Recording
                                            {isCorrect ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                                        </h4>

                                        {userAnswer && userAnswer.startsWith('http') ? (
                                            <audio controls src={userAnswer} className="w-full mt-2" />
                                        ) : (
                                            <p className="text-muted-foreground italic">No recording available</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </QuestionContainer>
    );
}
