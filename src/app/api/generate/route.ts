import { NextResponse } from "next/server";
import { generateQuestions, generateFullTest } from "@/lib/generators/questionGenerator";
import { getRecentTopics } from "@/lib/db/actions";
import { recordTopic } from "@/lib/db/admin-actions";
import { TEST_TEMPLATES } from "@/lib/generators/testTemplates";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { mode, examType, section, taskType, count, difficulty, userId, generationMode } = body;

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

            const questions = await generateFullTest(template, examType || 'toefl', targetLevel, generationMode || 'balanced');

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
            console.log(`📡 API: Generating Reading Drill (Module 1 routing) - Target: ~18 items`);

            // Module 1 routing (multistage): smaller first stage; Module 2 extends adaptively.
            const [academic, daily, words] = await Promise.all([
                generateQuestions(examType, section, 'Read an Academic Passage', 10, excludeTopics, 'B2', generationMode || 'balanced'),
                generateQuestions(examType, section, 'Read in Daily Life', 6, excludeTopics, 'B2', generationMode || 'balanced'),
                generateQuestions(examType, section, 'Complete The Words', 2, excludeTopics, 'B2', generationMode || 'balanced')
            ]);

            // Flatten structure
            questions = [
                ...daily,
                ...words,
                ...academic
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
            console.log(`📡 API: Generating Listening Drill (Module 1 routing) - Target: ~15 items`);

            // Module 1 routing (multistage): smaller first stage; Module 2 extends adaptively.
            const [choose, conversation, announcement, academicTalk] = await Promise.all([
                generateQuestions(examType, section, 'Listen and Choose a Response', 6, excludeTopics, 'B2', generationMode || 'balanced'),
                generateQuestions(examType, section, 'Listen to a Conversation', 4, excludeTopics, 'B2', generationMode || 'balanced'),
                generateQuestions(examType, section, 'Listen to an Announcement', 3, excludeTopics, 'B2', generationMode || 'balanced'),
                generateQuestions(examType, section, 'Listen to an Academic Talk', 2, excludeTopics, 'B2', generationMode || 'balanced')
            ]);

            questions = [...choose, ...conversation, ...announcement, ...academicTalk].map(q => ({
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
                generateQuestions(examType, section, 'Listen and Repeat', 7, excludeTopics, 'B2', generationMode || 'balanced'),
                generateQuestions(examType, section, 'Take an Interview', 4, excludeTopics, 'B2', generationMode || 'balanced')
            ]);

            questions = [...repeat, ...interview];
            // Don't shuffle - maintain order (Repeat first, then Interview)

        } else if (taskType === 'all' && section === 'writing') {
            console.log(`📡 API: Generating Writing Section (Target: ~23 mins)`);

            // Build a Sentence: ~6 items (6 mins)
            // Write an Email: 1 item (7 mins)
            // Academic Discussion: 1 item (10 mins)
            const [buildSentence, writeEmail, academicDiscussion] = await Promise.all([
                generateQuestions(examType, section, 'Build a Sentence', 10, excludeTopics, 'B2', generationMode || 'balanced'),
                generateQuestions(examType, section, 'Write an Email', 1, excludeTopics, 'B2', generationMode || 'balanced'),
                generateQuestions(examType, section, 'Write for an Academic Discussion', 1, excludeTopics, 'B2', generationMode || 'balanced')
            ]);

            questions = [...buildSentence, ...writeEmail, ...academicDiscussion];
            // Maintain order: Sentence -> Email -> Discussion

        } else {
            console.log(`📡 API: Generating Section Drill [${taskType}]`);
            questions = await generateQuestions(examType, section, taskType, count || 1, excludeTopics, 'B2', generationMode || 'balanced');
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
