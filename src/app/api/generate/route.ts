import { NextResponse } from "next/server";
import { generateQuestions, generateFullTest } from "@/lib/generators/questionGenerator";
import { TEST_TEMPLATES } from "@/lib/generators/testTemplates";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { mode, examType, section, taskType, count, difficulty } = body;

        // MODE 1: FULL TEST
        if (mode === 'full') {
            const template = TEST_TEMPLATES[difficulty] || TEST_TEMPLATES.practice;
            console.log(`📡 API: Generating Full Test [${difficulty}]`);

            const questions = await generateFullTest(template, examType || 'toefl');
            return NextResponse.json({ questions });
        }

        // MODE 2: SECTION DRILL (Original Logic)
        if (!examType || !section || !taskType) {
            return NextResponse.json(
                { error: "Missing required fields for section drill" },
                { status: 400 }
            );
        }

        let questions = [];

        // Special Case: "All" Task Type (Full Section Drill)
        // Official TOEFL iBT: Reading 35-48 items, Listening 35-45 items, Speaking 11 items
        // For Reading/Listening: Generate Module 1 only (half of total items)
        if (taskType === 'all' && section === 'reading') {
            console.log(`📡 API: Generating Reading Module 1 (Routing) - Target: ~24 items`);

            // Module 1: Half of full section (24 items total)
            // 4 Daily Life × ~2.5 = ~10 items
            // 1 Complete Words × 10 = 10 items
            // 1 Academic × 5 = 5 items (rounding error, but close to 24)
            const [dailyLife, completeWords, academic] = await Promise.all([
                generateQuestions(examType, section, 'Read in Daily Life', 4),
                generateQuestions(examType, section, 'Complete The Words', 1),
                generateQuestions(examType, section, 'Read an Academic Passage', 1)
            ]);

            questions = [...dailyLife, ...completeWords, ...academic].map(q => ({
                ...q,
                metadata: { ...q.metadata, module: 1 as 1 | 2, moduleType: 'routing' as 'routing' | 'easy' | 'hard' }
            }));
            questions.sort(() => Math.random() - 0.5);

        } else if (taskType === 'all' && section === 'listening') {
            console.log(`📡 API: Generating Listening Module 1 (Routing) - Target: ~21 items`);

            // Module 1: Half of full section (21 items total)
            // 3 Conversations × 3 = 9 items
            // 2 Announcements × 3 = 6 items
            // 2 Academic Talks × 4 = 8 items (rounding error, but close to 21)
            const [conversation, announcement, academicTalk] = await Promise.all([
                generateQuestions(examType, section, 'Listen to a Conversation', 3),
                generateQuestions(examType, section, 'Listen to an Announcement', 2),
                generateQuestions(examType, section, 'Listen to an Academic Talk', 2)
            ]);

            questions = [...conversation, ...announcement, ...academicTalk].map(q => ({
                ...q,
                metadata: { ...q.metadata, module: 1 as 1 | 2, moduleType: 'routing' as 'routing' | 'easy' | 'hard' }
            }));
            questions.sort(() => Math.random() - 0.5);

        } else if (taskType === 'all' && section === 'speaking') {
            console.log(`📡 API: Generating Mixed Speaking Section (11 items)`);

            // Listen and Repeat: 7 sentences
            // Take an Interview: 4 questions
            // Total: 11 items (no modules for Speaking)
            const [repeat, interview] = await Promise.all([
                generateQuestions(examType, section, 'Listen and Repeat', 7),
                generateQuestions(examType, section, 'Take an Interview', 4)
            ]);

            questions = [...repeat, ...interview];
            // Don't shuffle - maintain order (Repeat first, then Interview)

        } else if (taskType === 'all' && section === 'writing') {
            console.log(`📡 API: Generating Writing Section (Target: ~23 mins)`);

            // Build a Sentence: ~6 items (6 mins)
            // Write an Email: 1 item (7 mins)
            // Academic Discussion: 1 item (10 mins)
            const [buildSentence, writeEmail, academicDiscussion] = await Promise.all([
                generateQuestions(examType, section, 'Build a Sentence', 6),
                generateQuestions(examType, section, 'Write an Email', 1),
                generateQuestions(examType, section, 'Write for an Academic Discussion', 1)
            ]);

            questions = [...buildSentence, ...writeEmail, ...academicDiscussion];
            // Maintain order: Sentence -> Email -> Discussion

        } else {
            console.log(`📡 API: Generating Section Drill [${taskType}]`);
            questions = await generateQuestions(examType, section, taskType, count || 1);
        }

        return NextResponse.json({ questions });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
