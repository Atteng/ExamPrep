// Enhanced TTS with multi-speaker support

type VoiceGender = 'male' | 'female' | 'neutral';

let voicesLoaded = false;
let availableVoices: SpeechSynthesisVoice[] = [];

// Load voices on first use
const loadVoices = () => {
    if (voicesLoaded) return;

    availableVoices = window.speechSynthesis.getVoices();
    voicesLoaded = true;

    // Fallback: if voices not loaded yet, listen for event
    if (availableVoices.length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', () => {
            availableVoices = window.speechSynthesis.getVoices();
            voicesLoaded = true;
        });
    }
};

// Select voice by gender preference
const selectVoice = (gender: VoiceGender): SpeechSynthesisVoice | null => {
    loadVoices();

    if (availableVoices.length === 0) return null;

    // Try to find a voice matching the gender
    if (gender === 'female') {
        return availableVoices.find(v =>
            v.name.toLowerCase().includes('female') ||
            v.name.includes('Samantha') ||
            v.name.includes('Victoria') ||
            v.name.includes('Karen')
        ) || availableVoices[0];
    }

    if (gender === 'male') {
        return availableVoices.find(v =>
            v.name.toLowerCase().includes('male') ||
            v.name.includes('Daniel') ||
            v.name.includes('Alex') ||
            v.name.includes('Fred')
        ) || availableVoices[1] || availableVoices[0];
    }

    return availableVoices[0];
};

// Basic single-voice TTS (existing functionality)
export const speakText = (text: string, onEnd?: () => void) => {
    if (!window.speechSynthesis) {
        console.error("Browser does not support Speech Synthesis");
        if (onEnd) onEnd();
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.lang = "en-US";

    if (onEnd) {
        utterance.onend = onEnd;
    }

    window.speechSynthesis.speak(utterance);
};

// Multi-speaker conversation support
export const speakConversation = (transcript: string, onEnd?: () => void) => {
    if (!window.speechSynthesis) {
        console.error("Browser does not support Speech Synthesis");
        if (onEnd) onEnd();
        return;
    }

    window.speechSynthesis.cancel();
    loadVoices();

    // Parse conversation lines (format: "Speaker: text")
    const lines = transcript.split('\n').filter(line => line.trim());
    let currentIndex = 0;

    const speakNext = () => {
        if (currentIndex >= lines.length) {
            if (onEnd) onEnd();
            return;
        }

        const line = lines[currentIndex].trim();

        // Check if line has speaker label
        const colonIndex = line.indexOf(':');
        let text = line;
        let gender: VoiceGender = 'neutral';

        if (colonIndex > 0 && colonIndex < 20) { // Speaker label should be short
            const speaker = line.substring(0, colonIndex).trim().toLowerCase();
            text = line.substring(colonIndex + 1).trim();

            // Determine gender from speaker label
            if (speaker.includes('woman') || speaker.includes('female') || speaker.includes('she')) {
                gender = 'female';
            } else if (speaker.includes('man') || speaker.includes('male') || speaker.includes('he')) {
                gender = 'male';
            }
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = gender === 'female' ? 1.1 : 0.9;
        utterance.lang = "en-US";

        const voice = selectVoice(gender);
        if (voice) {
            utterance.voice = voice;
        }

        utterance.onend = () => {
            currentIndex++;
            // Small pause between speakers (200ms)
            setTimeout(speakNext, 200);
        };

        utterance.onerror = () => {
            console.error("Speech synthesis error");
            currentIndex++;
            speakNext();
        };

        window.speechSynthesis.speak(utterance);
    };

    speakNext();
};

export const stopSpeaking = () => {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};
