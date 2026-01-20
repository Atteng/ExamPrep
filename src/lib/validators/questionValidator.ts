import { QuestionData } from "@/types/question";

export interface ValidationResult {
    valid: boolean;
    score: number; // 0-100
    errors: string[];
}

export function validateQuestion(q: QuestionData): ValidationResult {
    const errors: string[] = [];
    let score = 100;

    // 1. Critical Field Checks
    if (!q.prompt || q.prompt.length < 5) {
        errors.push("Prompt is missing or too short");
        score -= 50;
    }
    if (!q.answerKey) {
        errors.push("Answer key is missing");
        score -= 50;
    }

    // 2. Task-Specific Checks
    if (q.options) {
        // Multiple Choice Validation
        if (!Array.isArray(q.options) || q.options.length < 2) {
            errors.push("Multiple choice options must be an array of at least 2 items");
            score -= 30;
        }

        // Ensure answer key matches one of the options (if distinct text match is expected)
        // Note: Sometimes keys are letters (A, B) or full text. Relaxed check here.
        const keyMatch = q.options.some(opt => opt.includes(q.answerKey as string) || (q.answerKey as string).includes(opt));
        if (!keyMatch && q.options.length > 0) {
            // Warning only, as simple substring matching might fail on subtle formatting
            // errors.push("Answer key does not appear in options");
            // score -= 10;
        }
    }

    // 3. Text/Passage Validation
    if (['Read Academic', 'Read Daily Life'].includes(q.taskType)) {
        if (!q.text || q.text.length < 50) {
            errors.push("Reading passage is missing or too short for reading task");
            score -= 40;
        }
    }

    return {
        valid: score > 60 && errors.length === 0,
        score: Math.max(0, score),
        errors
    };
}
