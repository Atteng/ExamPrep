import { supabaseAdmin } from '../supabaseAdmin';

// --- Topic History (Server-Side Admin) ---

export async function recordTopic(userId: string, topic: string) {
    if (!userId || !topic) return;

    // Fire and forget using Admin client to bypass RLS
    const { error } = await supabaseAdmin
        .from('topic_history')
        .insert({
            user_id: userId,
            topic: topic
        });

    if (error) {
        console.error('Error recording topic history:', error);
    }
}
