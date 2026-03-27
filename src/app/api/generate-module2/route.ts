import { NextResponse } from "next/server";
import { generateQuestions } from "@/lib/generators/questionGenerator";
import { getRecentTopics, recordTopic } from "@/lib/db/actions";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { examType, section, module1Score, userId, generationMode } = body; // accept userId

        if (!examType || !section || module1Score === undefined) {
            return NextResponse.json(
                { error: "Missing required fields: examType, section, module1Score" },
                { status: 400 }
            );
        }

        // Fetch user history if logged in
        let excludeTopics: string[] = [];
        if (userId) {
            excludeTopics = await getRecentTopics(userId); // Use shared action
        }

        // Determine Module 2 difficulty based on Module 1 performance
        const scorePercentage = module1Score; // Already a percentage (0-100)
        const isHard = scorePercentage >= 60;
        const moduleType = isHard ? 'hard' : 'easy';
        const targetLevel = isHard ? 'C1' : 'B1'; // True Adaptive Levels

        console.log(`📡 API: Generating Module 2 (${moduleType.toUpperCase()} - ${targetLevel}) - Score: ${scorePercentage}%`);

        let questions = [];

        if (section === 'reading') {
            // Module 2: ~24 items (same structure as Module 1)
            // 4 Daily Life × ~2.5 = ~10 items
            // 1 Complete Words × 10 = 10 items
            // 1 Academic × 5 = 5 items
            const [dailyLife, completeWords, academic] = await Promise.all([
                generateQuestions(examType, section, 'Read in Daily Life', 4, excludeTopics, targetLevel, generationMode || 'balanced'),
                generateQuestions(examType, section, 'Complete The Words', 1, excludeTopics, targetLevel, generationMode || 'balanced'), // Cloze is very sensitive to level
                generateQuestions(examType, section, 'Read an Academic Passage', 1, excludeTopics, targetLevel, generationMode || 'balanced')
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
                generateQuestions(examType, section, 'Listen to a Conversation', 3, excludeTopics, targetLevel, generationMode || 'balanced'),
                generateQuestions(examType, section, 'Listen to an Announcement', 2, excludeTopics, targetLevel, generationMode || 'balanced'),
                generateQuestions(examType, section, 'Listen to an Academic Talk', 2, excludeTopics, targetLevel, generationMode || 'balanced')
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

        // Record topics in background
        if (userId && questions.length > 0) {
            const topics = new Set(questions.map(q => q.metadata?.originalTopic).filter(Boolean));
            topics.forEach(t => recordTopic(userId, t as string));
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
