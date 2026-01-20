import { supabase } from '../supabase';

export interface UserProfile {
    id: string;
    email?: string;
    full_name?: string;
    target_exam?: 'toefl' | 'gre' | 'german';
    study_goal_hours?: number;
    metadata?: Record<string, any>; // For storing exam dates and targets
}

export interface ExamResult {
    id?: string;
    user_id: string;
    exam_type: 'toefl' | 'gre' | 'german';
    test_date?: string;
    total_score: number;
    max_score: number;
    section_scores: Record<string, number>;
    metadata?: Record<string, any>;
}

export interface GeneratedQuestion {
    id?: string;
    exam_type: string;
    section: string;
    content: any;
}

// --- User Profiles ---

export async function getUserProfile(userId: string) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        // PGRST116: JSON object requested, multiple (or no) results returned
        if (error.code !== 'PGRST116') {
            console.error('Error fetching profile:', error);
        }
        return null;
    }
    return data as UserProfile;
}

export async function signOut() {
    return await supabase.auth.signOut();
}

export async function updateUserProfile(profile: UserProfile) {
    const { data, error } = await supabase
        .from('profiles')
        .upsert(profile)
        .select()
        .single();

    if (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
    return data;
}

// --- Exam Results ---

export async function saveExamResult(result: ExamResult) {
    const { data, error } = await supabase
        .from('exam_results')
        .insert(result)
        .select()
        .single();

    if (error) {
        console.error('Error saving exam result:', error);
        throw error;
    }
    return data;
}

export async function getUserResults(userId: string) {
    const { data, error } = await supabase
        .from('exam_results')
        .select('*')
        .eq('user_id', userId)
        .order('test_date', { ascending: false });

    if (error) {
        console.error('Error fetching results:', error);
        return [];
    }
    return data as ExamResult[];
}

// --- Generated Questions (Cache) ---

export async function saveGeneratedQuestions(questions: GeneratedQuestion[]) {
    const { data, error } = await supabase
        .from('generated_questions')
        .insert(questions)
        .select();

    if (error) {
        console.error('Error caching questions:', error);
        // Don't throw, just log - caching failure shouldn't stop the app
    }
    return data;
}

export async function getCachedQuestions(examType: string, section: string, limit = 5) {
    // This is a simplified cache retrieval. Real usage might need more specific filters (taskType etc)
    // or grabbing random rows.
    const { data, error } = await supabase
        .from('generated_questions')
        .select('*')
        .eq('exam_type', examType)
        .eq('section', section)
        .limit(limit);

    if (error) {
        console.error('Error fetching cached questions:', error);
        return [];
    }
    return data;
}

// --- Content Library (Phase 11) ---

export async function getLibraryContent(contentType: string, filters?: { topic?: string, level?: string }) {
    let query = supabase
        .from('content_library')
        .select('*')
        .eq('content_type', contentType);

    // Optional: Filter by topic if provided AND if column/metadata supports it
    // Note: Since metadata is JSONB, we use the arrow operator ->>. 
    // This assumes specific structure. For generic matching, we might need flexibility.
    if (filters?.topic) {
        // Simple fuzzy match or check if metadata->topic equals
        query = query.ilike('metadata->>topic', `%${filters.topic}%`);
    }

    // Sort by stale usage to rotate content
    const { data, error } = await query
        .order('last_used_at', { ascending: true })
        .limit(20); // Fetch a pool to pick random from

    if (error || !data || data.length === 0) return null;

    // Pick random from the candidate pool to avoid repetitiveness
    const randomItem = data[Math.floor(Math.random() * data.length)];

    // Async update last_used_at to mark as recently used
    supabase.from('content_library').update({ last_used_at: new Date() }).eq('id', randomItem.id).then(() => { });

    return randomItem;
}

export async function saveLibraryContent(
    contentType: string,
    textContent: string,
    metadata: any
) {
    const { data, error } = await supabase
        .from('content_library')
        .insert({
            content_type: contentType,
            text_content: textContent,
            metadata: metadata
        })
        .select()
        .single();

    if (error) console.error("Library Save Failed:", error);
    return data;
}
