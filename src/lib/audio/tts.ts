// Enhanced TTS with Google Cloud API and Caching

type VoiceGender = 'male' | 'female' | 'neutral';

// Simple in-memory cache to save API costs
// Key: text, Value: Blob URL
const audioCache = new Map<string, string>();

// Circuit breaker to prevent endless 500 logs if API is down/unauthorized
let apiFailureCount = 0;
const MAX_API_FAILURES = 3;

/**
 * Fetch audio from our API proxy
 */
async function fetchTTS(text: string, gender: VoiceGender = 'neutral'): Promise<string> {
    // 0. Circuit Breaker
    if (apiFailureCount >= MAX_API_FAILURES) {
        // Silent fallback after threshold
        return "";
    }

    // 1. Check Cache
    const cacheKey = `${text}-${gender}`;
    if (audioCache.has(cacheKey)) {
        return audioCache.get(cacheKey)!;
    }

    try {
        // 2. Fetch from API
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                // We could pass gender here to select different voices in the backend
                // For now backend uses a default high-quality voice
                voiceId: gender === 'male' ? 'en-US-Journey-D' : 'en-US-Journey-F'
            })
        });

        if (!response.ok) {
            // Count failure but don't throw yet, simply return empty to trigger fallback
            apiFailureCount++;
            console.warn(`TTS API Warning (${apiFailureCount}/${MAX_API_FAILURES}): Endpoint returned ${response.status}. Falling back to browser.`);
            return "";
        }

        const data = await response.json();
        const audioContent = data.audioContent; // Base64 string

        // 3. Convert Base64 to Blob
        const binaryString = window.atob(audioContent);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);

        // 4. Cache it
        audioCache.set(cacheKey, url);

        // Reset failures on success
        apiFailureCount = 0;
        return url;

    } catch (err) {
        apiFailureCount++;
        console.warn(`TTS Connection Warning (${apiFailureCount}/${MAX_API_FAILURES}):`, err);
        return ""; // Empty string triggers fallback
    }
}

// Track current audio to enable stopping
let currentAudio: HTMLAudioElement | null = null;
let isSpeaking = false; // Lock to prevent concurrent calls

// Helper: Play audio URL and wait for completion
function playAudio(url: string): Promise<void> {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    return new Promise((resolve, reject) => {
        const audio = new Audio(url);
        currentAudio = audio; // Track it

        audio.onended = () => {
            currentAudio = null;
            resolve();
        };
        audio.onerror = (e) => {
            currentAudio = null;
            reject(e);
        };
        audio.play().catch(reject);
    });
}

// Helper: Browser fallback (Original Logic)
function speakBrowser(text: string, gender: VoiceGender, onEnd?: () => void) {
    if (!window.speechSynthesis) {
        if (onEnd) onEnd();
        return;
    }

    // Cancel any ongoing speech to avoid overlap during fallback
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    // Simple voice selection
    let voice = voices.find(v => v.lang.includes('en-US'));
    if (gender === 'female') voice = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha'));
    if (gender === 'male') voice = voices.find(v => v.name.includes('Male') || v.name.includes('Daniel'));

    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;

    utterance.onend = () => {
        isSpeaking = false; // Reset lock when browser TTS finishes
        if (onEnd) onEnd();
    };
    utterance.onerror = () => {
        isSpeaking = false; // Reset lock on error too
        if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
}

// --- EXPORTS ---

export const speakText = async (text: string, onEnd?: () => void) => {
    // Prevent concurrent calls
    if (isSpeaking) {
        console.warn("TTS: Already speaking, ignoring concurrent call");
        return;
    }

    isSpeaking = true;

    try {
        // Try API first
        const url = await fetchTTS(text, 'neutral');

        if (url) {
            try {
                await playAudio(url);
                if (onEnd) onEnd();
            } catch (e) {
                console.warn("Audio Playback failed, fallback to browser");
                speakBrowser(text, 'neutral', onEnd);
            }
        } else {
            speakBrowser(text, 'neutral', onEnd);
        }
    } finally {
        isSpeaking = false;
    }
};

export const speakConversation = async (transcript: string, onEnd?: () => void) => {
    const lines = transcript.split('\n').filter(line => line.trim());

    for (const line of lines) {
        // Parse and REMOVE Speaker labels
        const colonIndex = line.indexOf(':');
        let text = line;
        let gender: VoiceGender = 'neutral';

        if (colonIndex > 0 && colonIndex < 20) {
            const speaker = line.substring(0, colonIndex).trim().toLowerCase();
            text = line.substring(colonIndex + 1).trim(); // This strips the "Speaker:" part
            if (speaker.includes('woman') || speaker.includes('female')) gender = 'female';
            else if (speaker.includes('man') || speaker.includes('male')) gender = 'male';
        }

        // Additional safety: remove common speaker prefixes if they slipped through
        text = text.replace(/^(Speaker|Person|Student|Professor|Man|Woman):\s*/i, '').trim();

        // Try API
        const url = await fetchTTS(text, gender);

        if (url) {
            try {
                await playAudio(url);
            } catch (e) {
                // If one line fails, try browser for that line then continue
                await new Promise<void>(resolve => speakBrowser(text, gender, resolve));
            }
        } else {
            // Fallback to browser (wrapped in promise)
            await new Promise<void>(resolve => speakBrowser(text, gender, resolve));
        }

        // Small pause between speakers
        await new Promise(r => setTimeout(r, 300));
    }

    if (onEnd) onEnd();
};

export const stopSpeaking = () => {
    // Stop Browser
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    // Stop API Audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    // Reset lock
    isSpeaking = false;
};
