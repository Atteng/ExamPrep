"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
    src: string;
    onEnded?: () => void;
    autoPlay?: boolean;
    className?: string;
}

export default function AudioPlayer({ src, onEnded, autoPlay = false, className }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        if (autoPlay && audioRef.current) {
            audioRef.current.play().catch(() => {
                // Autoplay was prevented
                console.log("Autoplay prevented");
            });
        }
    }, [autoPlay, src]);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const toggleMute = () => {
        if (audioRef.current) {
            audioRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const current = audioRef.current.currentTime;
            const total = audioRef.current.duration;
            setProgress((current / total) * 100);

            if (current === total) {
                setIsPlaying(false);
                if (onEnded) onEnded();
            }
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        if (audioRef.current) {
            const time = (value / 100) * duration;
            audioRef.current.currentTime = time;
            setProgress(value);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        if (audioRef.current) {
            audioRef.current.volume = value;
            setVolume(value);
            setIsMuted(value === 0);
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className={cn("bg-card border rounded-lg p-4 shadow-sm w-full max-w-md", className)}>
            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
            />

            <div className="flex flex-col space-y-3">
                {/* Progress Bar */}
                <div className="w-full flex items-center space-x-2 text-xs text-muted-foreground">
                    <span className="w-8 text-right">{formatTime(audioRef.current?.currentTime || 0)}</span>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={progress || 0}
                        onChange={handleSeek}
                        className="flex-1 h-1.5 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                    />
                    <span className="w-8">{formatTime(duration)}</span>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={togglePlay}
                            className="bg-primary text-primary-foreground p-2.5 rounded-full hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            {isPlaying ? (
                                <Pause className="w-5 h-5 fill-current" />
                            ) : (
                                <Play className="w-5 h-5 fill-current ml-0.5" />
                            )}
                        </button>

                        <button
                            onClick={() => {
                                if (audioRef.current) {
                                    audioRef.current.currentTime = 0;
                                    audioRef.current.play();
                                    setIsPlaying(true);
                                }
                            }}
                            className="text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-muted/50 transition-colors"
                            title="Restart"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Volume */}
                    <div className="flex items-center space-x-2 w-24">
                        <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground">
                            {isMuted || volume === 0 ? (
                                <VolumeX className="w-4 h-4" />
                            ) : (
                                <Volume2 className="w-4 h-4" />
                            )}
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-muted-foreground"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
