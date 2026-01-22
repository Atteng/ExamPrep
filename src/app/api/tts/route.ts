import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { text, voiceId } = body;

        if (!text) {
            return NextResponse.json({ error: "Missing text" }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_CLOUD_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
        }



        // IMPORTANT: For Gemini TTS, we need to use the Text-to-Speech API, not the Generative Language API
        // The correct endpoint for standard Google Cloud Text-to-Speech API
        const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

        console.log("TTS Request - Text length:", text.length, "VoiceId:", voiceId);

        // 1. First Attempt: Try with verified Studio voices (Best quality available)
        // Verified available: en-US-Studio-O (Female), en-US-Studio-Q (Male)
        try {
            const studioVoice = voiceId?.includes('male') ? 'en-US-Studio-Q' : 'en-US-Studio-O';
            console.log("Attempting Studio voice:", studioVoice);

            const response = await fetch(ttsUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    audioConfig: {
                        audioEncoding: "MP3",
                        pitch: 0,
                        speakingRate: 1.0
                    },
                    input: { text: text },
                    voice: {
                        languageCode: "en-US",
                        name: studioVoice
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.audioContent) {
                    console.log("Studio voice succeeded");
                    return NextResponse.json({ audioContent: data.audioContent });
                }
            } else {
                const errorText = await response.text();
                // Check for specific API enablement or restriction error
                if (response.status === 403 && errorText.includes('PERMISSION_DENIED')) {
                    throw new Error('TTS Access Denied. Ensure Cloud Text-to-Speech API is ENABLED and your API Key has "Cloud Text-to-Speech API" added in its restrictions.');
                }

                console.warn(`Studio voice failed: ${response.status}`, errorText);
            }
        } catch (e) {
            console.warn("Studio voice error:", e);
        }

        // 3. Third Attempt: Fallback to reliable Neural2 voices
        console.log("Falling back to Neural2 voices");
        const response = await fetch(ttsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                audioConfig: {
                    audioEncoding: "MP3",
                    pitch: 0,
                    speakingRate: 1.0
                },
                input: { text: text },
                voice: {
                    languageCode: "en-US",
                    name: voiceId?.includes('male') ? 'en-US-Neural2-D' : 'en-US-Neural2-C'
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("All TTS attempts failed. Last error:", errorText);
            throw new Error(`All TTS Attempts Failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log("Neural2 voice succeeded");
        return NextResponse.json({ audioContent: data.audioContent });

    } catch (error: any) {
        console.error("TTS Proxy Critical Failure:", error);
        return NextResponse.json({
            error: error.message || "TTS synthesis failed",
            details: error.toString()
        }, { status: 500 });
    }
}
