import { supabase } from "@/lib/supabase";

export async function uploadAudioResponse(blob: Blob, userId: string, examType: string): Promise<string | null> {
    try {
        const timestamp = Date.now();
        const filename = `${userId}/${examType}/${timestamp}.webm`;

        const { data, error } = await supabase
            .storage
            .from('audio-responses') // Ensure this bucket exists in Supabase
            .upload(filename, blob, {
                contentType: 'audio/webm',
                upsert: true
            });

        if (error) {
            console.error("Upload Error Details:", {
                message: error.message,
                statusCode: (error as any).statusCode,
                error: error
            });
            throw error;
        }

        // Get Public URL
        const { data: publicData } = supabase
            .storage
            .from('audio-responses')
            .getPublicUrl(filename);

        return publicData.publicUrl;

    } catch (error) {
        console.error("Failed to upload audio:", error);
        return null;
    }
}
