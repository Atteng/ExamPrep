import { NextResponse } from "next/server";
import { model, generateWithRetry } from "@/lib/gemini";
import { Part } from "@google/generative-ai";
import { RUBRICS } from "@/lib/grading/rubrics";
import { gradeObjectiveSubmission } from "@/lib/grading/objectiveGrader";

const normalizeAnswer = (ans: any) => String(ans ?? "").replace(/^[A-D]\.\s*/i, "").trim();

// Helper for grading a single item
async function gradeSingleItem(submission: any) {
    const { examType, section, taskType, question, userAnswer } = submission;

    // 1. Objective Grading (Multiple Choice / Fill Blank / Build Sentence)
    const objectiveResult = gradeObjectiveSubmission(submission);
    if (objectiveResult) return objectiveResult;

    // 2. Subjective Grading (Writing / Speaking) via AI
    try {
        let rubricId = 'toefl-writing-academic';
        if (section === 'speaking') {
            if (taskType.includes('Repeat') || taskType === 'Listen and Repeat') {
                rubricId = 'toefl-speaking-repeat';
            } else if (taskType.includes('Interview') || taskType === 'Take an Interview') {
                rubricId = 'toefl-speaking-interview';
            }
        } else if (section === 'writing') {
            if (taskType.includes('Email')) {
                rubricId = 'toefl-writing-email';
            } else if (taskType.includes('Academic Discussion') || taskType.includes('academic_discussion')) {
                rubricId = 'toefl-writing-academic';
            }
        }

        const rubric = RUBRICS[rubricId] || RUBRICS['toefl-writing-academic'];

        // Check if input is Audio (URL)
        const isAudio = typeof userAnswer === 'string' && userAnswer.startsWith('http');
        let promptParts: (string | Part)[] = [];

        const textPrompt = `
        You are an expert TOEFL grader. Grade this student response using the OFFICIAL TOEFL rubric.
        
        Task Type: ${taskType}
        Question Prompt: "${question.prompt}"
        ${question.text ? `Context: "${question.text.substring(0, 300)}..."` : ''}

        OFFICIAL RUBRIC (${rubric.id}) - Scale: ${rubric.scale}:
        ${JSON.stringify(rubric.criteria, null, 2)}

        Focus Areas: ${rubric.focusAreas.join(', ')}

        CRITICAL INSTRUCTIONS:
        1. Assign a score STRICTLY based on the rubric scale (${rubric.scale}).
        2. For Listen & Repeat (0-5): Focus on exact word matching and intelligibility.
        3. For Interview (1-5): Evaluate all 4 dimensions (Content, Fluency, Pronunciation, Grammar).
        4. Provide specific, constructive feedback (max 2 sentences).
        5. Identify 1 strength and 1 weakness.
        ${isAudio ? '6. For audio: Evaluate pronunciation, intonation, fluency, and rhythm.' : ''}
        
        OUTPUT FORMAT (JSON):
        {
          "score": number (must be within ${rubric.scale}),
          "maxScore": number (max value of ${rubric.scale}),
          "feedback": "string",
          "strength": "string",
          "weakness": "string",
          "improvedVersion": "string (ONLY for Writing tasks: provide a Band 6 / High-Leveled version of the student's response using advanced vocabulary and varied syntax. Keep it empty for Speaking/Objective tasks.)"
        }
        `;

        promptParts.push(textPrompt);

        if (isAudio) {
            console.log("🔊 Detecting Audio Submission. Fetching blob...");
            const response = await fetch(userAnswer);
            if (!response.ok) throw new Error("Failed to fetch audio file");
            const arrayBuffer = await response.arrayBuffer();

            // Check for essentially empty/tiny files (under 1KB usually means header only or instant stop)
            if (arrayBuffer.byteLength < 1024) {
                return {
                    questionId: question.id,
                    score: 0,
                    feedback: "No speech detected in the recording. Please check your microphone.",
                    details: { rawScore: 0, maxScore: rubric.scale, error: "Empty audio file" }
                };
            }

            const base64Audio = Buffer.from(arrayBuffer).toString('base64');

            promptParts.push({
                inlineData: {
                    mimeType: "audio/webm",
                    data: base64Audio
                }
            });
            promptParts.push("Student Audio Response attached above.");
        } else {
            promptParts.push(`Student Text Response: "${userAnswer}"`);
        }

        // Add specific instruction for silence
        promptParts.push(`
        CRITICAL: If the audio is silent, mostly noise, or unintelligible, assign a score of 0 and state "No assessment possible - audio is silent/unclear". Do not hallucinatie a response.
        `);

        const result = await generateWithRetry(async () => {
            return await model.generateContent(promptParts as any);
        });

        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const evaluation = JSON.parse(text);

        return {
            questionId: question.id,
            score: (evaluation.score / evaluation.maxScore) * 100, // Normalized percentage
            feedback: evaluation.feedback,
            improvedVersion: evaluation.improvedVersion || null,
            details: evaluation
        };

    } catch (error) {
        console.error("AI Grading Error for Item:", error);
        return {
            questionId: question.id,
            score: 0,
            feedback: "Error during AI grading.",
            details: { error: String(error) }
        };
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { submissions, examType } = body;

        // Handle single submission (legacy) vs batch array
        const itemsToGrade = submissions || [body];

        console.log(`📝 Processing ${itemsToGrade.length} grading requests...`);

        const results = await Promise.all(itemsToGrade.map((item: any) => gradeSingleItem(item)));

        return NextResponse.json({
            results: results
        });

    } catch (error) {
        console.error("Grading API Fatal Error:", error);
        return NextResponse.json(
            { error: "Failed to grade response batch" },
            { status: 500 }
        );
    }
}
