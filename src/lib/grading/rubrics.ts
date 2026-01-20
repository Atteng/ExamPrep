export interface RubricCriteria {
    score: number;
    description: string;
}

export interface GradingRubric {
    id: string;
    criteria: Record<string, string>;
    focusAreas: string[];
    scale: string; // e.g. "0-5" or "1-5"
}

export const RUBRICS: Record<string, GradingRubric> = {
    // TOEFL Speaking: Listen and Repeat (Official - Lines 424-443)
    'toefl-speaking-repeat': {
        id: 'toefl-speaking-repeat',
        scale: '0-5',
        criteria: {
            "5": "Exact repetition. Fully intelligible.",
            "4": "Captures meaning, not exact. Minor changes, 1-2 words missing.",
            "3": "Essentially full, inaccurate meaning. Majority of content present but errors.",
            "2": "Missing significant part. Large portion missing or highly inaccurate.",
            "1": "Captures very little. Minimal response, mostly unintelligible.",
            "0": "No response or entirely unintelligible."
        },
        focusAreas: ["Accurate Repetition", "Intelligibility"]
    },

    // TOEFL Speaking: Take an Interview (Official - Lines 444-483)
    'toefl-speaking-interview': {
        id: 'toefl-speaking-interview',
        scale: '1-5',
        criteria: {
            "5": "Content: On topic, well elaborated | Fluency: Good pace, natural pauses | Pronunciation: Easily intelligible | Grammar/Vocabulary: Accurate",
            "4": "Content: On topic, elaborated | Fluency: Good pace generally | Pronunciation: Intelligible generally | Grammar/Vocabulary: Adequate",
            "3": "Content: Generally on topic, limited elaboration | Fluency: Choppy pace, frequent fillers | Pronunciation: Intelligibility sometimes affected | Grammar/Vocabulary: Limited range restricts clarity",
            "2": "Content: Minimally connected, little elaboration | Fluency: Limited | Pronunciation: Limited intelligibility | Grammar/Vocabulary: Very limited",
            "1": "Content: Vaguely connected | Fluency: N/A | Pronunciation: Mostly unintelligible | Grammar/Vocabulary: Isolated words"
        },
        focusAreas: ["Content & Elaboration", "Fluency & Pace", "Pronunciation & Intelligibility", "Grammar & Vocabulary"]
    },

    // TOEFL Writing: Email (Official - Lines 335-377)
    'toefl-writing-email': {
        id: 'toefl-writing-email',
        scale: '1-5',
        criteria: {
            "5": "Fully successful response. Effective, clearly expressed, consistent facility in language use. Elaboration effectively supports the communicative purpose. Effective syntactic variety and precise, idiomatic word choice. Consistent use of appropriate social conventions. Almost no lexical or grammatical errors.",
            "4": "Generally successful response. Mostly effective and easily understood, adequate language facility. Adequate elaboration to support communicative purpose. Syntactic variety and appropriate word choice. Mostly appropriate social conventions. Few lexical or grammatical errors.",
            "3": "Partially successful response. Generally accomplishes task, language limitations may prevent full clarity. Elaboration partially supports communicative purpose. Moderate range of syntax and vocabulary. Some noticeable errors in structure, word forms, idioms, social conventions.",
            "2": "Mostly unsuccessful response. Attempt to contribute, language limits understanding. Ideas poorly elaborated or only partially relevant. Limited range of syntax/vocabulary. Accumulation of errors.",
            "1": "Unsuccessful response. Ineffective attempt. Few coherent ideas. Severely limited range. Serious/frequent errors."
        },
        focusAreas: ["Communicative Purpose", "Social Conventions", "Elaboration & Clarity", "Language Use & Mechanics"]
    },

    // TOEFL Writing: Academic Discussion (Official - Lines 378-423)
    'toefl-writing-academic': {
        id: 'toefl-writing-academic',
        scale: '1-5',
        criteria: {
            "5": "Fully successful response. Relevant and well-elaborated explanations, arguments, and/or examples. Effective use of a variety of syntactic structures and precise, idiomatic word choice. Almost no lexical or grammatical errors.",
            "4": "Generally successful response. Relevant contribution with adequate elaboration. Variety of syntactic structures and appropriate word choice. Few minor lexical or grammatical errors.",
            "3": "Partially successful response. Mostly relevant/understandable, some language facility. Elaboration may be missing parts or unclear. Some variety in syntax/vocabulary. Some noticeable errors.",
            "2": "Mostly unsuccessful response. Attempt to contribute, language limits understanding. Ideas poorly elaborated or only partially relevant. Limited range of syntax/vocabulary. Accumulation of errors.",
            "1": "Unsuccessful response. Ineffective attempt. Few coherent ideas. Severely limited range. Serious/frequent errors."
        },
        focusAreas: ["Topic Development & Argumentation", "Elaboration & Support", "Syntactic Variety", "Vocabulary & Mechanics"]
    },

    // General: Objective (Multiple Choice)
    'objective': {
        id: 'objective',
        scale: '0-1',
        criteria: { "1": "Correct matches key", "0": "Incorrect" },
        focusAreas: ["Accuracy"]
    }
};

