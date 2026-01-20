import { ExamConfig } from "@/types/question";

export const EXAM_CONFIGS: Record<string, ExamConfig> = {
    toefl: {
        id: "toefl",
        title: "TOEFL iBT",
        description: "Test of English as a Foreign Language",
        scoring: { min: 0, max: 120, increment: 1 },
        sections: [
            {
                id: "reading",
                title: "Reading Section",
                timeLimit: 35 * 60, // 35 minutes
                questionCount: 20, // Approx
                instructions: "Read the passages and answer the questions. You can go back to previous questions within this section.",
            },
            {
                id: "listening",
                title: "Listening Section",
                timeLimit: 36 * 60, // 36 minutes
                questionCount: 28, // Approx
                instructions: "Listen to the audio clips. You will hear each clip only once. You cannot go back to previous questions.",
            },
            {
                id: "speaking",
                title: "Speaking Section",
                timeLimit: 16 * 60, // 16 minutes
                questionCount: 4,
                instructions: "Speak clearly into the microphone. Your responses will be recorded and graded.",
            },
            {
                id: "writing",
                title: "Writing Section",
                timeLimit: 29 * 60, // 29 minutes
                questionCount: 2,
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
