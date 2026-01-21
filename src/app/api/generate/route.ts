import { NextResponse } from "next/server";
import { generateQuestions, generateFullTest } from "@/lib/generators/questionGenerator";
import { getRecentTopics } from "@/lib/db/actions";
import { recordTopic } from "@/lib/db/admin-actions";
import { TEST_TEMPLATES } from "@/lib/generators/testTemplates";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { mode, examType, section, taskType, count, difficulty, userId } = body;

        // Fetch user history if logged in
        let excludeTopics: string[] = [];
        if (userId) {
            excludeTopics = await getRecentTopics(userId);
            // console.log(`📜 History: Excluding ${excludeTopics.length} recent topics`);
        }

        // MODE 1: FULL TEST
        if (mode === 'full') {
            const template = TEST_TEMPLATES[difficulty] || TEST_TEMPLATES.practice;

            // Map UI Mode to CEFR Level
            let targetLevel = 'B2';
            if (difficulty === 'learning') targetLevel = 'B1'; // Easier
            if (difficulty === 'challenge') targetLevel = 'C2'; // Harder

            console.log(`📡 API: Generating Full Test [${difficulty}] -> Level: ${targetLevel}`);

            const questions = await generateFullTest(template, examType || 'toefl', targetLevel);

            // Record topics in background
            if (userId && questions.length > 0) {
                const topics = new Set(questions.map(q => q.metadata?.originalTopic).filter(Boolean));
                topics.forEach(t => recordTopic(userId, t as string));
            }

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
        // Special Case: "All" Task Type (Full Section Drill)
        // Official TOEFL iBT: Reading 35-48 items, Listening 35-45 items, Speaking 11 items
        if (taskType === 'all' && section === 'reading') {
            console.log(`📡 API: Generating Reading Drill (High Volume) - Target: ~50 items`);

            // 1. Reading Passages: 3 Passages x 10 Questions = 30 items
            const passagePromises = [1, 2, 3].map(() =>
                generateQuestions(examType, section, 'Read an Academic Passage', 10, excludeTopics)
            );

            // 2. Daily Life: 15 items
            const dailyPromise = generateQuestions(examType, section, 'Read in Daily Life', 15, excludeTopics);

            // 3. Complete Words: 5 tasks
            const wordsPromises = [1, 2, 3, 4, 5].map(() =>
                generateQuestions(examType, section, 'Complete The Words', 1, excludeTopics)
            );

            const [passages, daily, words] = await Promise.all([
                Promise.all(passagePromises),
                dailyPromise,
                Promise.all(wordsPromises)
            ]);

            // Flatten structure
            questions = [
                ...daily,
                ...words.flat(),
                ...passages.flat()
            ].map(q => ({
                ...q,
                metadata: {
                    ...q.metadata,
                    module: 1 as 1 | 2,
                    moduleType: 'routing' as 'routing' | 'easy' | 'hard'
                }
            }));

            // Keep Daily/Words mixed at start, Passages at end generally works well
            // No shuffling of passages to keep questions grouped by text context
            console.log(`✅ Generated ${questions.length} Reading items`);

        } else if (taskType === 'all' && section === 'listening') {
            console.log(`📡 API: Generating Listening Drill (High Volume) - Target: ~48 items`);

            // Strategy: Double the typical volume (2 sets of everything)
            const [set1, set2] = await Promise.all([
                Promise.all([
                    generateQuestions(examType, section, 'Listen and Choose a Response', 5, excludeTopics),
                    generateQuestions(examType, section, 'Listen to a Conversation', 3, excludeTopics),
                    generateQuestions(examType, section, 'Listen to an Announcement', 2, excludeTopics),
                    generateQuestions(examType, section, 'Listen to an Academic Talk', 1, excludeTopics)
                ]),
                Promise.all([
                    generateQuestions(examType, section, 'Listen and Choose a Response', 5, excludeTopics),
                    generateQuestions(examType, section, 'Listen to a Conversation', 3, excludeTopics),
                    generateQuestions(examType, section, 'Listen to an Announcement', 2, excludeTopics),
                    generateQuestions(examType, section, 'Listen to an Academic Talk', 1, excludeTopics)
                ])
            ]);

            const allQuestions = [...set1.flat(), ...set2.flat()];

            questions = allQuestions.map(q => ({
                ...q,
                metadata: { ...q.metadata, module: 1 as 1 | 2, moduleType: 'routing' as 'routing' | 'easy' | 'hard' }
            }));
            questions.sort(() => Math.random() - 0.5);
            console.log(`✅ Generated ${questions.length} Listening items`);

        } else if (taskType === 'all' && section === 'speaking') {
            console.log(`📡 API: Generating Mixed Speaking Section (11 items)`);

            // Listen and Repeat: 7 sentences
            // Take an Interview: 4 questions
            // Total: 11 items (no modules for Speaking)
            const [repeat, interview] = await Promise.all([
                generateQuestions(examType, section, 'Listen and Repeat', 7, excludeTopics),
                generateQuestions(examType, section, 'Take an Interview', 4, excludeTopics)
            ]);

            questions = [...repeat, ...interview];
            // Don't shuffle - maintain order (Repeat first, then Interview)

        } else if (taskType === 'all' && section === 'writing') {
            console.log(`📡 API: Generating Writing Section (Target: ~23 mins)`);

            // Build a Sentence: ~6 items (6 mins)
            // Write an Email: 1 item (7 mins)
            // Academic Discussion: 1 item (10 mins)
            const [buildSentence, writeEmail, academicDiscussion] = await Promise.all([
                generateQuestions(examType, section, 'Build a Sentence', 10, excludeTopics),
                generateQuestions(examType, section, 'Write an Email', 1, excludeTopics),
                generateQuestions(examType, section, 'Write for an Academic Discussion', 1, excludeTopics)
            ]);

            questions = [...buildSentence, ...writeEmail, ...academicDiscussion];
            // Maintain order: Sentence -> Email -> Discussion

        } else {
            console.log(`📡 API: Generating Section Drill [${taskType}]`);
            questions = await generateQuestions(examType, section, taskType, count || 1, excludeTopics);
        }

        // Record topics in background
        if (userId && questions.length > 0) {
            const uniqueTopics = new Set(questions.map(q => q.metadata?.originalTopic).filter(Boolean));
            uniqueTopics.forEach(t => recordTopic(userId, t as string));
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
