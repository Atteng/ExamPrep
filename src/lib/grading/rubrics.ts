export interface RubricCriteria {
    score: number;
    description: string;
}

export interface GradingRubric {
    id: string; // e.g. 'toefl-writing-academic'
    criteria: Record<string, string>; // e.g. "5": "Well developed...", "4": "..."
    focusAreas: string[]; // e.g. ["Grammar", "Vocabulary", "Coherence"]
}

export const RUBRICS: Record<string, GradingRubric> = {
    // TOEFL Writing: Academic Discussion
    'toefl-writing-academic': {
        id: 'toefl-writing-academic',
        criteria: {
            "5": "Fully successful response. Relevant and well-elaborated explanations. Effective use of syntactic variety and precise word choice. Almost no errors.",
            "4": "Generally successful response. Relevant contribution with adequate elaboration. Variety of structures and appropriate word choice. Few minor errors.",
            "3": "Partially successful response. Elaboration may be missing parts or unclear. Some variety in syntax/vocabulary but noticeable errors.",
            "2": "Mostly unsuccessful response. Ideas poorly elaborated or only partially relevant. Limited range of syntax/vocabulary with accumulation of errors.",
            "1": "Unsuccessful response. Few coherent ideas. Severely limited range and serious/frequent errors."
        },
        focusAreas: ["Topic Development", "Grammar & Mechanics", "Vocabulary Usage", "Coherence"]
    },

    // TOEFL Writing: Email
    'toefl-writing-email': {
        id: 'toefl-writing-email',
        criteria: {
            "5": "Fully successful response. Elaboration effectively supports purpose. Effective syntactic variety and idiomatic word choice. Consistent social conventions.",
            "4": "Generally successful response. Adequate elaboration. Appropriate conventions. Few errors.",
            "3": "Partially successful response. Moderate range of syntax/vocabulary. Some noticeable errors in structure, word forms, or conventions.",
            "2": "Mostly unsuccessful response. Limited elaboration. Accumulation of errors.",
            "1": "Unsuccessful response. Very little elaboration. Telegraphic language. Serious errors."
        },
        focusAreas: ["Communicative Purpose", "Social Conventions", "Elaboration", "Language Use"]
    },

    // TOEFL Speaking: Independent / Interview
    'toefl-speaking-interview': {
        id: 'toefl-speaking-interview',
        criteria: {
            "4": "On topic, well elaborated. Good pace, natural pauses. Easily intelligible. Accurate grammar/vocabulary.",
            "3": "Generally on topic, limited elaboration. Choppy pace, frequent fillers. Intelligibility sometimes affected. Limited range.",
            "2": "Minimally connected, little elaboration. Limited intelligibility. Very limited grammar/vocabulary.",
            "1": "Vaguely connected. Mostly unintelligible. Isolated words.",
            "0": "No response or entirely unintelligible."
        },
        focusAreas: ["Delivery (Pace/Flow)", "Topic Development", "Language Use", "Intelligibility"]
    },

    // General: Fill in the blank (Objective)
    'objective': {
        id: 'objective',
        criteria: { "1": "Correct matches key", "0": "Incorrect" },
        focusAreas: ["Accuracy"]
    }
};
