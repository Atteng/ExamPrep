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
                // Updated TOEFL iBT (multistage): 35–48 items total.
                // Module 2 is generated adaptively after Module 1 in-app, so keep Module 1 around ~20 items.
                { taskTypes: ["Read an Academic Passage"], count: 10 },
                { taskTypes: ["Read in Daily Life"], count: 6 },
                { taskTypes: ["Complete The Words"], count: 2 }
            ],
            listening: [
                // Updated TOEFL iBT (multistage): 35–45 items total.
                // Module 2 is generated adaptively after Module 1 in-app, so keep Module 1 around ~18–20 items.
                { taskTypes: ["Listen and Choose a Response"], count: 6 },
                { taskTypes: ["Listen to a Conversation"], count: 4 },
                { taskTypes: ["Listen to an Announcement"], count: 3 },
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
                { taskTypes: ["Read an Academic Passage"], count: 10 },
                { taskTypes: ["Read in Daily Life"], count: 6 },
                { taskTypes: ["Complete The Words"], count: 2 }
            ],
            listening: [
                { taskTypes: ["Listen and Choose a Response"], count: 6 },
                { taskTypes: ["Listen to a Conversation"], count: 4 },
                { taskTypes: ["Listen to an Announcement"], count: 3 },
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
                { taskTypes: ["Read an Academic Passage"], count: 10 },
                { taskTypes: ["Read in Daily Life"], count: 6 },
                { taskTypes: ["Complete The Words"], count: 2 }
            ],
            listening: [
                { taskTypes: ["Listen and Choose a Response"], count: 6 },
                { taskTypes: ["Listen to a Conversation"], count: 4 },
                { taskTypes: ["Listen to an Announcement"], count: 3 },
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
