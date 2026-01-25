import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function cleanText(text: string): string {
    if (!text) return "";
    return text.replace(/\\n/g, '\n').trim();
}

/**
 * Robustly extracting text content from potentially messy JSON or raw strings
 */
export function extractQuestionContent(input: string | undefined): string {
    if (!input) return "";

    const cleanInput = input.trim();

    // If it doesn't look like JSON, just return processed text
    if (!cleanInput.startsWith('{') && !cleanInput.startsWith('[')) {
        return cleanText(cleanInput);
    }

    try {
        let parsed = JSON.parse(cleanInput);

        // Handle Array response: [{ paragraph: "..." }]
        if (Array.isArray(parsed)) {
            parsed = parsed[0] || {};
        }

        // Check common fields - Order matters (most specific to least)
        if (parsed.passage) return cleanText(parsed.passage);
        if (parsed.paragraph) return cleanText(parsed.paragraph);
        if (parsed.text) return cleanText(parsed.text);
        if (parsed.content) return cleanText(parsed.content);
        if (parsed.body) return cleanText(parsed.body);

        // If it was valid JSON but we couldn't find a field, return the original string 
        // fallback to pretty string only if it is complex object, 
        // but usually we want to try to prevent showing JSON. 
        // Let's try to join values if it is a flat object? No, that is risky.
        // Return raw if structure is unknown.
        return cleanText(cleanInput);

    } catch (e) {
        // Parsing failed, return raw
        return cleanText(cleanInput);
    }
}
