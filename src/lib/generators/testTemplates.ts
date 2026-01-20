export interface TestTemplate {
    mode: 'learning' | 'practice' | 'challenge';
    description: string;
    sections: {
        reading: { taskTypes: string[]; count: number }[];
        listening: { taskTypes: string[]; count: number }[];
        speaking: { taskTypes: string[]; count: number }[];
        writing: { taskTypes: string[]; count: number }[];
    };
}

export const TEST_TEMPLATES: Record<string, TestTemplate> = {
    learning: {
        mode: 'learning',
        description: "Balanced mix of easier tasks to build confidence.",
        sections: {
            reading: [
                { taskTypes: ["Complete The Words"], count: 4 },
                { taskTypes: ["Read in Daily Life"], count: 4 }
            ],
            listening: [
                { taskTypes: ["Listen and Choose a Response"], count: 6 }
            ],
            speaking: [
                { taskTypes: ["Listen and Repeat"], count: 4 }
            ],
            writing: [
                { taskTypes: ["Build a Sentence"], count: 4 },
                { taskTypes: ["Write an Email"], count: 2 }
            ]
        }
    },
    practice: {
        mode: 'practice',
        description: "Standard difficulty mirroring the actual exam structure.",
        sections: {
            reading: [
                { taskTypes: ["Read in Daily Life", "Read an Academic Passage"], count: 10 }
            ],
            listening: [
                { taskTypes: ["Listen to a Conversation", "Listen to an Academic Talk"], count: 12 }
            ],
            speaking: [
                { taskTypes: ["Listen and Repeat", "Take an Interview"], count: 6 }
            ],
            writing: [
                { taskTypes: ["Write an Email", "Write for an Academic Discussion"], count: 8 }
            ]
        }
    },
    challenge: {
        mode: 'challenge',
        description: "High-difficulty questions focused on C1/C2 level skills.",
        sections: {
            reading: [
                { taskTypes: ["Read an Academic Passage"], count: 12 }
            ],
            listening: [
                { taskTypes: ["Listen to an Academic Talk"], count: 15 }
            ],
            speaking: [
                { taskTypes: ["Take an Interview"], count: 8 }
            ],
            writing: [
                { taskTypes: ["Write for an Academic Discussion"], count: 4 }
            ]
        }
    }
};
