import { cn } from "@/lib/utils";
import { QuestionData } from "@/types/question";

interface QuestionContainerProps {
    question: QuestionData;
    children: React.ReactNode;
    className?: string;
}

export function QuestionContainer({ question, children, className }: QuestionContainerProps) {
    return (
        <div className={cn("w-full max-w-3xl mx-auto space-y-6", className)}>
            {/* Header / Prompt Area */}
            <div className="bg-card border rounded-xl p-4 md:p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                    {question.taskType}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                    {question.prompt}
                </p>
            </div>

            {/* Main Content Area (Reading Passage, Image, Audio, etc.) */}
            {/* Specific renderers will inject content here via children */}
            <div className="min-h-[200px] md:min-h-[300px]">
                {children}
            </div>
        </div>
    );
}
