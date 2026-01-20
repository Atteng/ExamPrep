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
        description: "Standard TOEFL structure (Full Volume) at easier CEFR level (B1).",
        sections: {
            reading: [
                { taskTypes: ["Read an Academic Passage"], count: 30 },
                { taskTypes: ["Read in Daily Life"], count: 15 },
                { taskTypes: ["Complete The Words"], count: 5 }
            ],
            listening: [
                { taskTypes: ["Listen and Choose a Response"], count: 9 },
                { taskTypes: ["Listen to a Conversation"], count: 6 },
                { taskTypes: ["Listen to an Announcement"], count: 4 },
                { taskTypes: ["Listen to an Academic Talk"], count: 2 }
            ],
            speaking: [
                { taskTypes: ["Listen and Repeat"], count: 7 },
                { taskTypes: ["Take an Interview"], count: 4 }
            ],
            writing: [
                { taskTypes: ["Build a Sentence"], count: 10 },
                { taskTypes: ["Write an Email"], count: 1 },
                { taskTypes: ["Write for an Academic Discussion"], count: 1 }
            ]
        }
    },
    practice: {
        mode: 'practice',
        description: "Standard TOEFL structure (Full Volume) at standard CEFR level (B2).",
        sections: {
            reading: [
                { taskTypes: ["Read an Academic Passage"], count: 30 }, // 3 Passages x 10 Qs
                { taskTypes: ["Read in Daily Life"], count: 15 },
                { taskTypes: ["Complete The Words"], count: 5 }
            ],
            listening: [
                { taskTypes: ["Listen and Choose a Response"], count: 9 },
                { taskTypes: ["Listen to a Conversation"], count: 6 },
                { taskTypes: ["Listen to an Announcement"], count: 4 },
                { taskTypes: ["Listen to an Academic Talk"], count: 2 }
            ],
            speaking: [
                { taskTypes: ["Listen and Repeat"], count: 7 },
                { taskTypes: ["Take an Interview"], count: 4 }
            ],
            writing: [
                { taskTypes: ["Build a Sentence"], count: 10 },
                { taskTypes: ["Write an Email"], count: 1 },
                { taskTypes: ["Write for an Academic Discussion"], count: 1 }
            ]
        }
    },
    challenge: {
        mode: 'challenge',
        description: "Standard TOEFL structure (Full Volume) at diffcult CEFR level (C1/C2).",
        sections: {
            reading: [
                { taskTypes: ["Read an Academic Passage"], count: 30 },
                { taskTypes: ["Read in Daily Life"], count: 15 },
                { taskTypes: ["Complete The Words"], count: 5 }
            ],
            listening: [
                { taskTypes: ["Listen and Choose a Response"], count: 9 },
                { taskTypes: ["Listen to a Conversation"], count: 6 },
                { taskTypes: ["Listen to an Announcement"], count: 4 },
                { taskTypes: ["Listen to an Academic Talk"], count: 2 }
            ],
            speaking: [
                { taskTypes: ["Listen and Repeat"], count: 7 },
                { taskTypes: ["Take an Interview"], count: 4 }
            ],
            writing: [
                { taskTypes: ["Build a Sentence"], count: 10 },
                { taskTypes: ["Write an Email"], count: 1 },
                { taskTypes: ["Write for an Academic Discussion"], count: 1 }
            ]
        }
    }
};
