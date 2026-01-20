"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, RotateCcw, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
    onStop: (blob: Blob, duration: number) => void;
    timeLimit?: number; // In seconds
}

export default function AudioRecorder({ onStop, timeLimit }: AudioRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [timeLeft, setTimeLeft] = useState(timeLimit || 60);
    const [duration, setDuration] = useState(0);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

    // Visualization
    const [volume, setVolume] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Initialize Timer
    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setDuration(d => d + 1);
                if (timeLimit) {
                    setTimeLeft(t => {
                        if (t <= 1) {
                            stopRecording();
                            return 0;
                        }
                        return t - 1;
                    });
                }
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isRecording, timeLimit]);

    // Cleanup resources
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioUrl(url);
                onStop(blob, duration);

                // Cleanup Visualizer
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                setVolume(0);
            };

            mediaRecorder.start();
            setIsRecording(true);
            setDuration(0);
            if (timeLimit) setTimeLeft(timeLimit);
            setAudioUrl(null); // Clear previous

            // Setup Visualizer
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            const updateVolume = () => {
                analyser.getByteFrequencyData(dataArray);
                const sum = dataArray.reduce((a, b) => a + b, 0);
                const average = sum / bufferLength;
                setVolume(average); // Normalize slightly if needed (0-255)
                animationFrameRef.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();

        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Microphone access denied. Please check your browser settings.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-card shadow-sm space-y-6 w-full max-w-md mx-auto">

            {/* Visualizer / Status */}
            <div className="relative w-32 h-32 flex items-center justify-center">
                {/* Ring Animation based on volume */}
                {isRecording && (
                    <div
                        className="absolute inset-0 rounded-full bg-red-500/20 transition-all duration-75 ease-out"
                        style={{ transform: `scale(${1 + (volume / 100)})` }}
                    />
                )}

                <div className={cn(
                    "w-24 h-24 rounded-full flex items-center justify-center transition-colors shadow-inner border-4",
                    isRecording ? "bg-red-500 border-red-200" : "bg-muted border-input"
                )}>
                    {isRecording ? (
                        <Mic className="w-10 h-10 text-white animate-pulse" />
                    ) : (
                        <Mic className="w-10 h-10 text-muted-foreground" />
                    )}
                </div>
            </div>

            {/* Timers & Labels */}
            <div className="text-center space-y-1">
                <div className="text-3xl font-mono font-bold tracking-wider">
                    {timeLimit
                        ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`
                        : `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`
                    }
                </div>
                <p className="text-sm text-muted-foreground">
                    {isRecording ? "Recording..." : audioUrl ? "Recording Complete" : "Ready to Record"}
                </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
                {!isRecording ? (
                    <button
                        onClick={startRecording}
                        className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-all shadow-md active:scale-95"
                    >
                        {audioUrl ? <RotateCcw className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        {audioUrl ? "Record Again" : "Start Recording"}
                    </button>
                ) : (
                    <button
                        onClick={stopRecording}
                        className="flex items-center gap-2 px-6 py-2 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-all shadow-md active:scale-95"
                    >
                        <Square className="w-4 h-4 fill-current" />
                        Stop
                    </button>
                )}
            </div>

            {/* Playback Preview */}
            {audioUrl && !isRecording && (
                <div className="w-full bg-muted/50 p-2 rounded-lg mt-2">
                    <audio src={audioUrl} controls className="w-full h-10" />
                </div>
            )}
        </div>
    );
}
