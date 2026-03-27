import { ExamConfig } from "@/types/question";

export const EXAM_CONFIGS: Record<string, ExamConfig> = {
    toefl: {
        id: "toefl",
        title: "TOEFL iBT",
        description: "Test of English as a Foreign Language",
        // TOEFL iBT (updated format) uses a 1–6 band scale in 0.5 increments.
        scoring: { min: 1, max: 6, increment: 0.5 },
        sections: [
            {
                id: "reading",
                title: "Reading Section",
                timeLimit: 27 * 60, // About 27 minutes (multistage/adaptive)
                questionCount: 42, // Official range ~35–48
                instructions: "Read the texts and answer the questions. The Reading section is multistage/adaptive, so the length and difficulty may vary.",
            },
            {
                id: "listening",
                title: "Listening Section",
                timeLimit: 27 * 60, // About 27 minutes (multistage/adaptive)
                questionCount: 40, // Official range ~35–45
                instructions: "Listen to the audio and answer the questions. You will hear each clip only once. The Listening section is multistage/adaptive, so the length and difficulty may vary.",
            },
            {
                id: "speaking",
                title: "Speaking Section",
                timeLimit: 8 * 60,
                questionCount: 11,
                instructions: "Speak clearly into the microphone. Your responses will be recorded and graded.",
            },
            {
                id: "writing",
                title: "Writing Section",
                timeLimit: 23 * 60, // About 23 minutes
                questionCount: 12,
                instructions: "Write your responses in the text box provided. Pay attention to grammar and vocabulary.",
            },
        ],
    },
    gre: {
        id: "gre",
        title: "GRE General Test",
        description: "Graduate Record Examination",
        scoring: { min: 260, max: 340, increment: 1 },
        sections: [
            {
                id: "analytical",
                title: "Analytical Writing",
                timeLimit: 30 * 60,
                questionCount: 1,
                instructions: "Analyze the issue and support your position.",
            },
            {
                id: "verbal",
                title: "Verbal Reasoning",
                timeLimit: 18 * 60, // Section 1 (Section 2 is 23 min)
                questionCount: 12,
                instructions: "Select the best answer for each question.",
            },
            {
                id: "quantitative",
                title: "Quantitative Reasoning",
                timeLimit: 21 * 60, // Section 1 (Section 2 is 26 min)
                questionCount: 12,
                instructions: "Solve the problems and select the correct answer.",
            },
        ],
    },
    german: {
        id: "german",
        title: "German Language Exam",
        description: "Goethe-Zertifikat / Telc B1-C1",
        scoring: { min: 0, max: 100, increment: 1 },
        sections: [
            {
                id: "reading",
                title: "Lesen (Reading)",
                timeLimit: 65 * 60,
                questionCount: 30,
                instructions: "Read the texts and answer the questions.",
            },
            {
                id: "listening",
                title: "Hören (Listening)",
                timeLimit: 40 * 60,
                questionCount: 30,
                instructions: "Listen to the audio and select the correct answers.",
            },
            {
                id: "writing",
                title: "Schreiben (Writing)",
                timeLimit: 60 * 60,
                questionCount: 2,
                instructions: "Write a text based on the prompt.",
            },
            {
                id: "speaking",
                title: "Sprechen (Speaking)",
                timeLimit: 15 * 60,
                questionCount: 3,
                instructions: "Participate in a conversation and present a topic.",
            },
        ],
    },
};
