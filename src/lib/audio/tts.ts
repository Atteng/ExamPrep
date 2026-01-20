// Enhanced TTS with Google Cloud API and Caching

type VoiceGender = 'male' | 'female' | 'neutral';

// Simple in-memory cache to save API costs
// Key: text, Value: Blob URL
const audioCache = new Map<string, string>();

/**
 * Fetch audio from our API proxy
 */
async function fetchTTS(text: string, gender: VoiceGender = 'neutral'): Promise<string> {
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

        if (!response.ok) throw new Error("TTS API Failed");

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
        return url;

    } catch (err) {
        console.error("TTS Fetch Error, falling back to browser:", err);
        return ""; // Empty string triggers fallback
    }
}

// Track current audio to enable stopping
let currentAudio: HTMLAudioElement | null = null;

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

    utterance.onend = () => { if (onEnd) onEnd(); };
    utterance.onerror = () => { if (onEnd) onEnd(); };

    window.speechSynthesis.speak(utterance);
}

// --- EXPORTS ---

export const speakText = async (text: string, onEnd?: () => void) => {
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
};

export const speakConversation = async (transcript: string, onEnd?: () => void) => {
    const lines = transcript.split('\n').filter(line => line.trim());

    for (const line of lines) {
        // Parse Speaker
        const colonIndex = line.indexOf(':');
        let text = line;
        let gender: VoiceGender = 'neutral';

        if (colonIndex > 0 && colonIndex < 20) {
            const speaker = line.substring(0, colonIndex).trim().toLowerCase();
            text = line.substring(colonIndex + 1).trim();
            if (speaker.includes('woman') || speaker.includes('female')) gender = 'female';
            else if (speaker.includes('man') || speaker.includes('male')) gender = 'male';
        }

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
};
