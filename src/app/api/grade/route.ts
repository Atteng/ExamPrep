import { NextResponse } from "next/server";
import { model, generateWithRetry } from "@/lib/gemini";
import { Part } from "@google/generative-ai";
import { RUBRICS } from "@/lib/grading/rubrics";

export async function POST(req: Request) {
    try {
        const { examType, section, taskType, question, userAnswer } = await req.json();

        // 1. Objective Grading (Multiple Choice / Fill Blank / Build Sentence)
        if ((['reading', 'listening'].includes(section) || (section === 'writing' && (taskType === 'Build a Sentence' || taskType === 'build_sentence'))) && (question.answerKey || question.target_sentence)) {

            // Special Case: Build a Sentence
            if (taskType === 'Build a Sentence' || taskType === 'build_sentence') {
                const target = question.structure?.example?.target_sentence || question.answerKey || "";
                const isCorrect = String(userAnswer).trim() === String(target).trim();
                return NextResponse.json({
                    score: isCorrect ? 100 : 0,
                    feedback: isCorrect ? "Correct!" : `Incorrect. The correct sentence was: "${target}"`,
                    details: { rawScore: isCorrect ? 1 : 0, maxScore: 1 }
                });
            }

            // Special Logic for 'Complete The Words' (Partial Scoring)
            if (taskType === 'Complete The Words' || taskType === 'complete_words') {
                const userParts = String(userAnswer).split(',').map(s => s.trim().toLowerCase());

                // Parse Answer Key: "(1) ght (2) at ..." -> ["ght", "at"]
                const answerParts: string[] = [];
                const matches = Array.from(String(question.answerKey).matchAll(/\(\d+\)\s*(\w+)/g));
                for (const match of matches) {
                    answerParts.push(match[1].toLowerCase());
                }

                let correctCount = 0;
                const total = answerParts.length;

                answerParts.forEach((correct, idx) => {
                    if (userParts[idx] === correct) correctCount++;
                });

                const score = total > 0 ? (correctCount / total) * 100 : 0;

                return NextResponse.json({
                    score: Math.round(score),
                    feedback: `You got ${correctCount} out of ${total} correct.`,
                    details: {
                        rawScore: correctCount,
                        maxScore: total,
                        userAnswers: userParts,
                        correctAnswers: answerParts
                    }
                });
            }

            // Standard Multiple Choice Logic
            const isCorrect = String(userAnswer).trim() === String(question.answerKey).trim() || (
                typeof question.answerKey === 'string' &&
                question.options &&
                question.options.some((opt: string) => opt.includes(userAnswer) && opt.includes(question.answerKey))
            );

            return NextResponse.json({
                score: isCorrect ? 100 : 0,
                feedback: isCorrect ? "Correct!" : `Incorrect. The correct answer was: ${question.answerKey}`,
                details: {
                    rawScore: isCorrect ? 1 : 0,
                    maxScore: 1
                }
            });
        }

        // 2. Subjective Grading (Writing / Speaking) via AI
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
          "weakness": "string"
        }
        `;

        promptParts.push(textPrompt);

        if (isAudio) {
            console.log("🔊 Detecting Audio Submission. Fetching blob...");
            try {
                const response = await fetch(userAnswer);
                if (!response.ok) throw new Error("Failed to fetch audio file");
                const arrayBuffer = await response.arrayBuffer();
                const base64Audio = Buffer.from(arrayBuffer).toString('base64');

                // Add Audio Part to Prompt
                promptParts.push({
                    inlineData: {
                        mimeType: "audio/webm",
                        data: base64Audio
                    }
                });
                promptParts.push("Student Audio Response attached above.");
            } catch (err) {
                console.error("Audio fetch failed:", err);
                return NextResponse.json({
                    score: 0,
                    feedback: "Error: Could not retrieve audio file for grading. Please check your connection."
                });
            }
        } else {
            promptParts.push(`Student Text Response: "${userAnswer}"`);
        }

        const result = await generateWithRetry(async () => {
            return await model.generateContent(promptParts as any);
        });

        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const evaluation = JSON.parse(text);

        return NextResponse.json({
            score: (evaluation.score / evaluation.maxScore) * 100, // Normalized percentage
            feedback: evaluation.feedback,
            details: evaluation
        });

    } catch (error) {
        console.error("Grading Error:", error);
        return NextResponse.json(
            { error: "Failed to grade response" },
            { status: 500 }
        );
    }
}
