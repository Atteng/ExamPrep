import { NextResponse } from "next/server";
import { generateQuestions } from "@/lib/generators/questionGenerator";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { examType, section, module1Score } = body;

        if (!examType || !section || module1Score === undefined) {
            return NextResponse.json(
                { error: "Missing required fields: examType, section, module1Score" },
                { status: 400 }
            );
        }

        // Determine Module 2 difficulty based on Module 1 performance
        const scorePercentage = module1Score; // Already a percentage (0-100)
        const moduleType = scorePercentage >= 60 ? 'hard' : 'easy';

        console.log(`📡 API: Generating Module 2 (${moduleType.toUpperCase()}) - Score: ${scorePercentage}%`);

        let questions = [];

        if (section === 'reading') {
            // Module 2: ~24 items (same structure as Module 1)
            // 4 Daily Life × ~2.5 = ~10 items
            // 1 Complete Words × 10 = 10 items
            // 1 Academic × 5 = 5 items
            const [dailyLife, completeWords, academic] = await Promise.all([
                generateQuestions(examType, section, 'Read in Daily Life', 4),
                generateQuestions(examType, section, 'Complete The Words', 1),
                generateQuestions(examType, section, 'Read an Academic Passage', 1)
            ]);

            questions = [...dailyLife, ...completeWords, ...academic].map(q => ({
                ...q,
                metadata: {
                    ...q.metadata,
                    module: 2 as 1 | 2,
                    moduleType: moduleType as 'routing' | 'easy' | 'hard',
                    difficulty: moduleType as 'easy' | 'medium' | 'hard'
                }
            }));
            questions.sort(() => Math.random() - 0.5);

        } else if (section === 'listening') {
            // Module 2: ~21 items (same structure as Module 1)
            // 3 Conversations × 3 = 9 items
            // 2 Announcements × 3 = 6 items
            // 2 Academic Talks × 4 = 8 items
            const [conversation, announcement, academicTalk] = await Promise.all([
                generateQuestions(examType, section, 'Listen to a Conversation', 3),
                generateQuestions(examType, section, 'Listen to an Announcement', 2),
                generateQuestions(examType, section, 'Listen to an Academic Talk', 2)
            ]);

            questions = [...conversation, ...announcement, ...academicTalk].map(q => ({
                ...q,
                metadata: {
                    ...q.metadata,
                    module: 2 as 1 | 2,
                    moduleType: moduleType as 'routing' | 'easy' | 'hard',
                    difficulty: moduleType as 'easy' | 'medium' | 'hard'
                }
            }));
            questions.sort(() => Math.random() - 0.5);

        } else {
            return NextResponse.json(
                { error: "Module 2 only applies to reading and listening sections" },
                { status: 400 }
            );
        }

        console.log(`✅ Generated ${questions.length} Module 2 (${moduleType}) questions`);
        return NextResponse.json({ questions, moduleType });

    } catch (error: any) {
        console.error("Module 2 Generation Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
