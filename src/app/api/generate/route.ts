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
        if (taskType === 'all' && section === 'reading') {
            console.log(`📡 API: Generating Mixed Reading Section`);

            // Parallel generation of different types
            const [dailyLife, completeWords, academic] = await Promise.all([
                generateQuestions(examType, section, 'Read in Daily Life', 4),
                generateQuestions(examType, section, 'Complete The Words', 4),
                generateQuestions(examType, section, 'Read an Academic Passage', 2) // 2 passages (~10 questions)
            ]);

            questions = [...dailyLife, ...completeWords, ...academic];

            // Shuffle properly
            questions.sort(() => Math.random() - 0.5);

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
