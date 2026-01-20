import { supabase } from "@/lib/supabase";

export type SchoolStatus = 'active' | 'submitted' | 'accepted' | 'rejected';

export interface SchoolRequirement {
    item: string;
    done: boolean;
}

export interface School {
    id: string;
    user_id: string;
    name: string;
    program: string | null;
    status: SchoolStatus;
    deadline: string | null;
    requirements: SchoolRequirement[];
    created_at: string;
    // New V1 Fields
    location?: string;
    fee_amount?: string;
    fee_note?: string;
    test_toefl?: string;
    test_ielts?: string;
    test_gre?: string;
    insights?: string[];
}

export interface NewSchool {
    name: string;
    program?: string;
    deadline?: string;
    status?: SchoolStatus;
    requirements?: SchoolRequirement[];
    // New V1 Fields
    location?: string;
    fee_amount?: string;
    fee_note?: string;
    test_toefl?: string;
    test_ielts?: string;
    test_gre?: string;
    insights?: string[];
}

/**
 * Fetch all schools for the current user
 */
export async function getSchools(userId: string): Promise<School[]> {
    const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('user_id', userId)
        .order('deadline', { ascending: true });

    if (error) {
        console.error("Error fetching schools:", error);
        throw error;
    }

    return data as School[];
}

/**
 * Add a new school application
 */
export async function addSchool(userId: string, school: NewSchool): Promise<School> {
    const { data, error } = await supabase
        .from('schools')
        .insert({
            user_id: userId,
            name: school.name,
            program: school.program,
            deadline: school.deadline,
            status: school.status || 'active',
            requirements: school.requirements || [],
            location: school.location,
            fee_amount: school.fee_amount,
            fee_note: school.fee_note,
            test_toefl: school.test_toefl,
            test_ielts: school.test_ielts,
            test_gre: school.test_gre,
            insights: school.insights || []
        })
        .select()
        .single();

    if (error) {
        console.error("Error adding school:", error);
        throw error;
    }

    return data as School;
}

/**
 * Update an existing school
 */
export async function updateSchool(id: string, updates: Partial<School>): Promise<School> {
    const { data, error } = await supabase
        .from('schools')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error("Error updating school:", error);
        throw error;
    }

    return data as School;
}

/**
 * Delete a school
 */
export async function deleteSchool(id: string): Promise<void> {
    const { error } = await supabase
        .from('schools')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Error deleting school:", error);
        throw error;
    }
}
