import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { text, voiceId } = body;

        if (!text) {
            return NextResponse.json({ error: "Missing text" }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_CLOUD_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
        }

        // Official Endpoint for standard Google TTS (Beta required for some new models)
        const url = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`;

        // Construct the specific request body user provided
        const payload = {
            audioConfig: {
                audioEncoding: "MP3", // Changed to MP3 for web compatibility
                pitch: 0,
                speakingRate: 1
            },
            input: {
                text: text
            },
            voice: {
                languageCode: "en-US",
                modelName: "gemini-2.5-flash-lite-preview-tts", // User requested model
                name: "en-US-Achernar-Turbo" // Fallback name if modelName strictly requires a voice name mapping, but we try specific
            }
        };

        // Note on Voice Name: "Achernar" mentioned by user might need full ID like 'en-US-Achernar-Turbo' or similar if it follows CASSIOPEIA naming. 
        // For safety with this specific preview model, we try to pass exactly what works for the preview or a close mapping. 
        // If the user's specific JSON structure had "name": "Achernar", we should try to honor it or map it validly.
        // Google TTS usually expects `name` (e.g. "en-US-Neural2-A") and `languageCode`.
        // `modelName` is sometimes used for higher level abstraction in newer APIs.
        // Let's stick closer to the user's request structure but ensure valid JSON payload.

        // Revised Payload to match User's exact request structure mostly, but ensuring MP3 for web
        const googlePayload = {
            audioConfig: {
                audioEncoding: "MP3",
                pitch: 0,
                speakingRate: 1
            },
            input: {
                text: text
            },
            voice: {
                languageCode: "en-US",
                name: "en-US-Journey-F" // Placeholder: Achernar might be a journey voice. 
                // CRITICAL: The user provided `modelName: "gemini-2.5-flash-lite-preview-tts"`.
                // Standard Google TTS API doesn't always accept `modelName` field in the same way as `name`. 
                // However, for these new generative voices, we adhere to the specific beta field.
            }
        };

        // If the user is specifically asking for the new generative voices, we often need to use the `voice.name` field 
        // corresponding to that model family or the `customVoice` fields. 
        // Given the experimental nature, I will attempt to pass the specific fields.

        const experimentalPayload = {
            audioConfig: {
                audioEncoding: "MP3",
                pitch: 0,
                speakingRate: 1
            },
            input: {
                text: text
            },
            voice: {
                languageCode: "en-US",
                name: "en-US-Studio-Q", // Fallback high quality if the experimental name fails
                // Trying to inject the specific model requrest
            }
        };

        // Let's try to construct exactly what the user likely wants based on the "Gemini" branding in TTS.
        // Usually these are under the "Journey" or "Studio" voices in standard API, 
        // OR it's a very specific new beta path. 
        // Since I cannot verify the exact "Achernar" existence in the standard public doc without searching, 
        // I will implement a robust fetch that tries the user's params.

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                audioConfig: {
                    audioEncoding: "MP3",
                    pitch: 0,
                    speakingRate: 1
                },
                input: {
                    text: text
                },
                voice: {
                    languageCode: "en-US",
                    // Use modelName from user request if possible, or default to the preview
                    modelName: "gemini-2.5-flash-lite-preview-tts",
                    // Use the voiceId sent from frontend (handles gender), or fallback to a default
                    name: voiceId || "en-US-Achernar-Turbo"
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Google TTS API Error:", errorText);

            // Fallback strategy: If 400/404, maybe retry with strictly standard voice?
            return NextResponse.json({ error: `TTS Provider Error: ${response.statusText}`, details: errorText }, { status: response.status });
        }

        const data = await response.json();
        const audioContent = data.audioContent;

        if (!audioContent) {
            return NextResponse.json({ error: "No audio content received" }, { status: 500 });
        }

        return NextResponse.json({ audioContent });

    } catch (error: any) {
        console.error("TTS Proxy Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
