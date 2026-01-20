"use client";

import { useEffect, useState, useRef } from "react";
import { QuestionData } from "@/types/question";
import { QuestionContainer } from "../QuestionContainer";
import { speakText, stopSpeaking } from "@/lib/audio/tts";
import { uploadAudioResponse } from "@/lib/db/storage";
import { PlayCircle, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListenRepeatProps {
    question: QuestionData;
    onAnswer: (answer: string) => void;
}

type FlowState = 'initial' | 'playing' | 'waiting' | 'recording' | 'complete';

export default function ListenRepeat({ question, onAnswer }: ListenRepeatProps) {
    const [flowState, setFlowState] = useState<FlowState>('initial');
    const [countdown, setCountdown] = useState(0);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    const sentenceToRepeat = question.text;
    const PREP_DELAY = 1; // 1 second delay after audio (with beep)
    const RECORDING_TIME = 15; // 15 seconds to repeat

    useEffect(() => {
        // Auto-play on mount
        handleStartFlow();

        return () => {
            stopSpeaking();
            stopRecording();
        };
    }, [question.id]);

    const handleStartFlow = () => {
        setFlowState('playing');
        speakText(sentenceToRepeat || "No text available", () => {
            // Audio finished, start countdown to recording
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

    const playBeep = () => {
        // Simple beep using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800; // 800 Hz beep
        gainNode.gain.value = 0.3;

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1); // 100ms beep
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

            // Auto-stop after time limit
            let remaining = RECORDING_TIME;
            const interval = setInterval(() => {
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

        const url = await uploadAudioResponse(blob, 'anonymous_user', 'toefl');

        if (url) {
            console.log("Audio uploaded:", url);
            onAnswer(url);
        } else {
            console.error("Upload failed");
            alert("Failed to upload audio. Please try again.");
        }
    };

    return (
        <QuestionContainer question={question}>
            <div className="flex flex-col items-center justify-center space-y-8 min-h-[400px]">

                {/* Status Display */}
                <div className="text-center space-y-4">
                    {flowState === 'initial' && (
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
                            <p className="text-sm text-muted-foreground">Recording will start automatically</p>
                        </>
                    )}

                    {flowState === 'recording' && (
                        <>
                            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                                <Mic className="w-10 h-10 text-red-500 animate-pulse" />
                            </div>
                            <h3 className="text-xl font-medium text-red-500">Recording...</h3>
                            <div className="text-3xl font-bold">{countdown}s</div>
                            <p className="text-sm text-muted-foreground">Repeat the sentence you heard</p>
                        </>
                    )}

                    {flowState === 'complete' && (
                        <>
                            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                                <MicOff className="w-10 h-10 text-green-500" />
                            </div>
                            <h3 className="text-xl font-medium text-green-600">Complete!</h3>
                            <p className="text-sm text-muted-foreground">Your response has been recorded</p>
                        </>
                    )}
                </div>
            </div>
        </QuestionContainer>
    );
}
