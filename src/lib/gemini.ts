import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy_key");

// Lazy Getter for Model
export function getGeminiModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY in environment variables");
    }
    // Reconfigure correctly if key exists
    const client = new GoogleGenerativeAI(apiKey);
    return client.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
        }
    });
}

// Deprecated direct export (kept for compatibility if needed, but safer)
// But to fix the crash, we MUST NOT throw at top level.
// We'll update usage sites to use getGeminiModel() OR make this a proxy.
// For now, let's keep `model` object but make its methods throw if key missing?
// No, simpler to update usage in questionGenerator.ts.
// Actually, let's just make `model` a proxy or do the check inside `generateWithRetry`.

// REVISED STRATEGY: Global instance with dummy key to allow import, 
// but methods throw if real key missing.
// However, GoogleGenerativeAI might validate key format in constructor?
// Yes, it does. "dummy_key" might fail constructor.
// So we must handle this carefully.

// Let's go with the Lazy Accessor approach.
export const model = {
    generateContent: async (prompt: any) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

        const realClient = new GoogleGenerativeAI(apiKey);
        const realModel = realClient.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.7,
            }
        });
        return await realModel.generateContent(prompt);
    }
};

// --- Rate Limiter (Queue Based) ---
class RateLimiter {
    private queue: Promise<void> = Promise.resolve();
    private minInterval = 2000; // 2 seconds between calls

    async schedule<T>(fn: () => Promise<T>): Promise<T> {
        // Chain the new request to the end of the queue
        const result = this.queue.then(async () => {
            const now = Date.now();
            const start = Date.now();

            // Execute the function
            const value = await fn();

            // Ensure we waited at least minInterval since start
            const elapsed = Date.now() - start;
            if (elapsed < this.minInterval) {
                await new Promise(resolve => setTimeout(resolve, this.minInterval - elapsed));
            }
            return value;
        });

        // Update queue pointer (catch errors so queue doesn't stall)
        this.queue = result.then(() => { }).catch(() => { });

        return result;
    }
}

export const rateLimiter = new RateLimiter();

// --- Retry Wrapper ---
export async function generateWithRetry(generatorFn: () => Promise<any>, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            // Use schedule to ensure serialized execution
            return await rateLimiter.schedule(generatorFn);
        } catch (error: any) {
            console.warn(`Attempt ${i + 1} failed:`, error.message);
            if (i === maxRetries - 1) throw error;
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
    }
}
