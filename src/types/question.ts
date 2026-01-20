export type ExamType = 'toefl' | 'gre' | 'german';
export type SectionType =
    | 'reading'
    | 'listening'
    | 'speaking'
    | 'writing' // TOEFL & German
    | 'verbal'
    | 'quantitative'
    | 'analytical'; // GRE

export interface ScoringRubric {
    [score: string]: {
        description: string;
        criteria?: string[];
    };
}

export interface QuestionData {
    id: string; // Unique GUID
    examType: ExamType;
    section: SectionType;
    taskType: string; // e.g., "Complete The Words", "Listen and Repeat"

    // Content varies by type
    prompt: string;
    text?: string; // For reading passages
    context?: string; // For Writing tasks (scenario context)
    audioTranscript?: string; // For listening/speaking
    audioUrl?: string; // For playback

    // Question specifics
    options?: string[]; // Multiple choice options
    answerKey?: string | string[] | number; // Correct answer(s)

    // Metadata for AI generation tracking
    metadata?: {
        difficulty?: 'easy' | 'medium' | 'hard';
        topic?: string;
        skillsTested?: string[];
        source?: 'ai-generated' | 'official-seed';
        estimatedTime?: number;
        originalTopic?: string; // Track the topic used for hybrid generation
        module?: 1 | 2; // Which module this question belongs to (for adaptive testing)
        moduleType?: 'routing' | 'easy' | 'hard'; // Module difficulty type
    };

    // For multi-question tasks (Listening sets)
    questions?: {
        id: string;
        prompt: string;
        options: string[];
        answerKey: string;
    }[];

    // For Writing tasks with complex structure
    structure?: {
        prompt?: string;
        context?: string;
        example?: {
            scrambled_parts?: string[];
            target_sentence?: string;
            scenario?: string;
            task?: string;
            recipient?: string;
            subject?: string;
            professor_post?: string;
            student_posts?: Array<{
                name: string;
                content: string;
            }>;
        };
        scenario?: string;
        task?: string;
        recipient?: string;
        subject?: string;
        professor_post?: string;
        student_posts?: Array<{
            name: string;
            content: string;
        }>;
    };

    rubric?: ScoringRubric; // For subjective tasks (Writing/Speaking)
}

export interface ExamSectionConfig {
    id: SectionType;
    title: string;
    timeLimit: number; // in seconds
    questionCount: number;
    instructions: string;
}

export interface ExamConfig {
    id: ExamType;
    title: string;
    description: string;
    sections: ExamSectionConfig[];
    scoring: {
        min: number;
        max: number;
        increment: number;
        unit?: string;
    };
}
