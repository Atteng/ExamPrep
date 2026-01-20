"use client";

import { cn } from "@/lib/utils";

interface MultipleChoiceProps {
    options: string[];
    selectedOption?: string | number | null;
    onSelect: (option: string | number) => void;
    layout?: "vertical" | "horizontal" | "grid";
    disabled?: boolean;
}

export function MultipleChoice({
    options,
    selectedOption,
    onSelect,
    layout = "vertical",
    disabled = false
}: MultipleChoiceProps) {
    return (
        <div className={cn(
            "gap-3",
            layout === "vertical" && "flex flex-col",
            layout === "horizontal" && "flex flex-row flex-wrap",
            layout === "grid" && "grid grid-cols-1 md:grid-cols-2"
        )}>
            {options.map((option, index) => {
                // Handle logic for A, B, C, D labels if needed, or just use index
                const isSelected = selectedOption === option || selectedOption === index;
                const letter = String.fromCharCode(65 + index); // A, B, C...

                return (
                    <button
                        key={index}
                        onClick={() => !disabled && onSelect(option)}
                        disabled={disabled}
                        className={cn(
                            "group relative flex items-start w-full p-4 text-left border rounded-lg transition-all hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                            isSelected
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "bg-card hover:border-primary/50",
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <span className={cn(
                            "flex items-center justify-center w-6 h-6 mr-3 text-xs font-bold rounded border shrink-0 transition-colors",
                            isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-muted-foreground border-input group-hover:border-primary/50"
                        )}>
                            {letter}
                        </span>
                        <span className="text-sm md:text-base leading-relaxed">
                            {option}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
