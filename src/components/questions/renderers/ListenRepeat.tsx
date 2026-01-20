"use client";

import { useEffect, useState } from "react";
import { QuestionData } from "@/types/question";
import { QuestionContainer } from "../QuestionContainer";
import AudioRecorder from "@/components/audio/AudioRecorder";
import { speakText, stopSpeaking } from "@/lib/audio/tts";
import { uploadAudioResponse } from "@/lib/db/storage";
import { PlayCircle, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListenRepeatProps {
    question: QuestionData;
    onAnswer: (answer: string) => void;
}

export default function ListenRepeat({ question, onAnswer }: ListenRepeatProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [canRecord, setCanRecord] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

    // Extract the sentence to repeat. 
    // Usually in question.text, or sometimes question.prompt is the instruction and text is the content.
    // For ListenRepeat, the text IS the audio transcript.
    const sentenceToRepeat = question.text;

    useEffect(() => {
        // Reset state on new question
        setRecordedBlob(null);
        setCanRecord(false);
        stopSpeaking();
    }, [question.id]);

    const handlePlayAudio = () => {
        setIsPlaying(true);
        speakText(sentenceToRepeat || "No text available", () => {
            setIsPlaying(false);
            setCanRecord(true); // Allow recording after listening
        });
    };

    const handleStopRecording = async (blob: Blob, duration: number) => {
        setRecordedBlob(blob);

        // Upload to Storage
        // ID is not auth-protected in this MVP layer, we use a temp ID or 'anonymous' if needed
        // Ideally we get userId from context/auth
        const url = await uploadAudioResponse(blob, 'anonymous_user', 'toefl');

        if (url) {
            console.log("Audio uploaded:", url);
            onAnswer(url); // Submit URL as answer
        } else {
            console.error("Upload failed");
            alert("Failed to upload audio. Please try again.");
        }
    };

    return (
        <QuestionContainer question={question}>
            <div className="flex flex-col items-center justify-center space-y-8 min-h-[400px]">

                {/* 1. Listen Section */}
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <PlayCircle className={cn("w-10 h-10 text-primary", isPlaying && "animate-pulse")} />
                    </div>

                    <h3 className="text-xl font-medium">Listen to the sentence</h3>

                    <button
                        onClick={handlePlayAudio}
                        disabled={isPlaying}
                        className="px-6 py-2 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 disabled:opacity-50 transition-all font-medium"
                    >
                        {isPlaying ? "Playing..." : "Play Audio"}
                    </button>
                </div>

                {/* Divider */}
                <div className="w-full max-w-sm border-t border-muted" />

                {/* 2. Record Section */}
                <div className={cn("text-center space-y-4 transition-opacity duration-500", !canRecord && "opacity-50 grayscale pointer-events-none")}>
                    <h3 className="text-xl font-medium">Repeat the sentence</h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        Click record and repeat exactly what you heard. Speak clearly.
                    </p>

                    <div className="mt-4">
                        <AudioRecorder
                            onStop={handleStopRecording}
                            timeLimit={20} // Short time for repeat task 
                        />
                    </div>
                </div>

                {/* Debug / Training Wheels: Show text if needed (Hidden for real test usually) */}
                {/* <p className="text-xs text-muted-foreground mt-8">Debug: {sentenceToRepeat}</p> */}
            </div>
        </QuestionContainer>
    );
}
