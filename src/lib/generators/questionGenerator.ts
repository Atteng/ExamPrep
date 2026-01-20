import { model, generateWithRetry } from "../gemini";
import { validateQuestion } from "../validators/questionValidator";
import { QuestionData, ExamType, SectionType } from "@/types/question";
import { TestTemplate } from "./testTemplates";
import { TOEFL_PROMPT, GRE_PROMPT, GERMAN_PROMPT } from "./promptTemplates";
import toeflData from "@/data/toefl_source_data.json";
import { getLibraryContent, saveLibraryContent } from "@/lib/db/actions";

// Helper to find examples in source data
function getSourceData(taskType: string) {
    // Search through all sections
    const sections = ['reading', 'listening', 'writing', 'speaking'];
    for (const section of sections) {
        // @ts-ignore
        const task = toeflData[section]?.task_types?.find((t: any) => t.name === taskType);
        if (task) return task;
    }
    return null;
}

// Helper: Cloze Masking for 'Complete The Words'
function applyClozeMasking(text: string) {
    const words = text.split(/\s+/);
    let maskedText = "";
    let answerParts: string[] = [];
    let maskedCount = 0;

    words.forEach((word, index) => {
        // Mask every 2nd word that is long enough (Hybrid V1 Logic)
        if ((index + 1) % 2 === 0 && word.length > 3) {
            const cleanWord = word.replace(/[.,!?;:'"]/g, '');
            const punctuation = word.slice(cleanWord.length);
            const halfPoint = Math.ceil(cleanWord.length / 2);
            const visible = cleanWord.slice(0, halfPoint);
            const hidden = cleanWord.slice(halfPoint);

            maskedText += ` ${visible}_ _ _${punctuation}`;
            answerParts.push(`(${maskedCount + 1}) ${hidden}`);
            maskedCount++;
        } else {
            maskedText += ` ${word}`;
        }
    });

    return {
        maskedText: maskedText.trim(),
        answerKey: answerParts.join(' '),
    };
}

// Helper: Random Topic Generator
function getRandomTopic() {
    const topics = [
        "Campus Life", "Modern History", "Environmental Science",
        "Art History", "Psychology", "Technology", "Economics", "Astronomy"
    ];
    return topics[Math.floor(Math.random() * topics.length)];
}

// Helper: Determine Level (Mock logic, eventually from User Profile)
function getTargetLevel() {
    return "B2"; // Default to Upper Intermediate
}

/**
 * HYBRID GENERATION HELPER
 * Attempts to fetch content from DB first. If missing, generates via AI and saves to DB.
 */
async function fetchOrGenerateContent(
    contentType: string,
    topic: string,
    level: string,
    aiPrompt: string
): Promise<{ text: string, source: 'official-seed' | 'ai-generated' }> {
    // 1. Try Cache
    try {
        const cachedItem = await getLibraryContent(contentType, { topic, level });
        if (cachedItem) {
            console.log(`🟢 HIT: Using Cached Content for [${contentType}]`);
            return { text: cachedItem.text_content, source: 'official-seed' };
        }
    } catch (err) {
        console.warn("Library fetch failed, falling back to AI", err);
    }

    // 2. Generate New
    console.log(`🔴 MISS: Generating New Content for [${contentType}]`);
    const result = await model.generateContent(aiPrompt);
    const text = result.response.text();

    // 3. Background Save (Fire and Forget)
    saveLibraryContent(contentType, text, { topic, level }).catch(err => console.error("Cache Save Failed", err));

    return { text, source: 'ai-generated' };
}

export async function generateQuestions(
    examType: string,
    section: string,
    taskType: string,
    count: number = 1
): Promise<QuestionData[]> {
    const sourceTask = getSourceData(taskType);

    // Smart Context
    const topic = getRandomTopic();
    const level = getTargetLevel();

    // --- STRATEGY A: HYBRID (Complete The Words) ---
    if (taskType === 'complete_words' || taskType === 'Complete The Words') {
        const { text, source } = await fetchOrGenerateContent(
            'reading_passage_short',
            topic,
            level,
            `Write a single academic paragraph about ${topic}. Requirements: CEFR Level ${level}, Length 80 words. Tone: Educational. Output: Just raw text.`
        );

        // Sanitize text: If it's JSON (e.g. {"paragraph": "..."}), extract the content
        let cleanText = text;
        try {
            if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed) && parsed[0]?.paragraph) cleanText = parsed[0].paragraph;
                else if (Array.isArray(parsed) && parsed[0]?.text) cleanText = parsed[0].text;
                else if (parsed.paragraph) cleanText = parsed.paragraph;
                else if (parsed.text) cleanText = parsed.text;
                else if (parsed.content) cleanText = parsed.content;
            }
        } catch (e) {
            // Not valid JSON, keep original text
        }

        const processed = applyClozeMasking(cleanText);

        return [{
            id: crypto.randomUUID(),
            examType: examType as ExamType,
            section: section as SectionType,
            taskType: "Complete The Words",
            prompt: "Complete the missing letters in the following passage:",
            text: processed.maskedText,
            answerKey: processed.answerKey,
            metadata: { source, difficulty: 'hard', originalTopic: topic }
        }];
    }

    // --- STRATEGY B: HYBRID (Reading/Speaking with Context) ---
    // Leverage seeded content if available for specific Reading/Speaking tasks
    if (
        (section === 'reading' && (taskType.includes('Academic') || taskType.includes('Daily'))) ||
        (section === 'speaking' && (taskType.includes('Repeat') || taskType.includes('Interview')))
    ) {
        // Map task types to content types
        let contentType = 'reading_passage_academic'; // default
        if (taskType.includes('Daily')) contentType = 'reading_passage_daily';
        else if (taskType.includes('Repeat')) contentType = 'speaking_sentence';
        else if (taskType.includes('Interview')) contentType = 'speaking_interview_question';

        // 1. Fetch Text from Library (or generate if missing)
        let promptText = "";
        if (contentType === 'speaking_sentence') promptText = `Write ${count} simple academic sentences for a 'Listen and Repeat' test. Topics: ${topic}. Level: ${level}. Output: JSON array of strings.`;
        else if (contentType === 'speaking_interview_question') promptText = `Write ${count} open-ended interview questions about ${topic}. Level: ${level}. Output: JSON array of strings.`;
        else promptText = `Write a ${contentType.includes('daily') ? 'real-world text (e.g. email, ad)' : 'academic passage'} about ${topic}. Requirements: CEFR ${level}, 150-200 words.`;

        const { text, source } = await fetchOrGenerateContent(
            contentType,
            topic,
            level,
            promptText
        );

        // 2. Process Content into Question Objects
        // Special handling for Speaking lists (sentence arrays) vs Reading passages
        if (section === 'speaking') {
            let items: string[] = [];
            try {
                // Attempt JSON parse first if we asked for array
                if (text.trim().startsWith('[')) {
                    items = JSON.parse(text);
                } else {
                    // Fallback to splitting by newlines
                    items = text.split('\n').filter(l => l.trim().length > 10);
                }
            } catch (e) { items = [text]; }

            return items.slice(0, count).map((item, idx) => ({
                id: crypto.randomUUID(),
                examType: examType as ExamType,
                section: section as SectionType,
                taskType: taskType,
                prompt: taskType.includes('Repeat') ? "Repeat the sentence exactly." : "Answer the question.",
                text: item, // The sentence/question to speak/answer
                answerKey: "N/A - Subjective Grading",
                metadata: { source, difficulty: 'medium', originalTopic: topic }
            }));
        }

        // ... Standard Reading Logic (Existing code) ...
        const hybridPrompt = `
        CONTEXT TEXT:
        """${text}"""

        TASK:
        Generate ${count} multiple-choice question(s) based on the text above.
        examType: ${examType}
        taskType: ${taskType}
        level: ${level}

        JSON OUTPUT FORMAT:
        [{
          "id": "uuid",
          "examType": "${examType}",
          "section": "${section}",
          "taskType": "${taskType}",
          "prompt": "Question text...",
          "text": "${text.substring(0, 20)}...", 
          "options": ["A", "B", "C", "D"],
          "answerKey": "The correct option text"
        }]
        
        IMPORTANT: 
        - The questions must be answerable ONLY from the text.
        - Include the full text in the 'text' field for every question object to ensure standalone rendering.
        `;

        try {
            const result = await generateWithRetry(async () => await model.generateContent(hybridPrompt));
            const raw = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(raw) as QuestionData[];

            return parsed.map(q => ({
                ...q,
                id: crypto.randomUUID(),
                text: text, // STRICTLY ENFORCE: Use the fetched text, not whatever the AI hallucinated/summarized
                metadata: { ...q.metadata, source, originalTopic: topic }
            }));
        } catch (e) {
            console.error("Hybrid Reading Gen Failed:", e);
            // Fallthrough to Standard Strategy if this fails
        }
    }

    // --- STRATEGY C: STANDARD AI GENERATION ---
    let promptTemplate = "";

    switch (examType.toLowerCase()) {
        case 'gre': promptTemplate = GRE_PROMPT; break;
        case 'german': promptTemplate = GERMAN_PROMPT; break;
        case 'toefl': default: promptTemplate = TOEFL_PROMPT; break;
    }

    const hydratedPrompt = promptTemplate
        .replace('${count}', count.toString())
        .replace('${taskType}', taskType)
        .replace('${section}', section)
        .replace('${topic}', topic)
        .replace('${level}', level)
        .replace('${reference}', JSON.stringify(sourceTask || {}, null, 2));

    const finalPrompt = `
    ${hydratedPrompt}
    
    GLOBAL REQUIREMENTS:
    1. Generate entirely new content.
    2. Maintain strict JSON format.
    3. Output strictly an Array of Objects.
    
    JSON SCHEMA:
    [{
      "id": "uuid",
      "examType": "${examType}",
      "section": "${section}",
      "taskType": "${taskType}",
      "prompt": "The question prompt",
      "text": "Reading passage if needed",
      "options": ["A", "B", "C", "D"],
      "answerKey": "The correct option text"
    }]
    `;

    try {
        const result = await generateWithRetry(async () => {
            return await model.generateContent(finalPrompt);
        });

        const text = result.response.text()
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();

        const parsed = JSON.parse(text) as QuestionData[];

        const validQuestions = parsed.filter(q => {
            const validation = validateQuestion(q);
            if (!validation.valid) {
                console.warn("⚠️ Invalid AI Question Dropped:", validation.errors);
            }
            return validation.valid;
        });

        if (validQuestions.length === 0) throw new Error("All generated questions failed validation");

        return validQuestions.map(q => ({
            ...q,
            id: q.id || crypto.randomUUID(),
            examType: examType as ExamType,
            section: section as SectionType,
            taskType
        }));

    } catch (error) {
        console.error("AI Generation Error:", error);
        throw new Error("Failed to generate questions after retries.");
    }
}

export async function generateFullTest(template: TestTemplate, examType: string = 'toefl'): Promise<QuestionData[]> {
    console.log(`🚀 Starting Full Test Generation [Mode: ${template.mode}]`);
    const allQuestions: QuestionData[] = [];
    const tasks: { section: string, taskType: string, count: number }[] = [];

    ['reading', 'listening', 'speaking', 'writing'].forEach(section => {
        // @ts-ignore
        const configArr = template.sections[section];
        if (configArr) {
            configArr.forEach((config: any) => {
                config.taskTypes.forEach((taskType: string) => {
                    tasks.push({ section, taskType, count: config.count });
                });
            });
        }
    });

    for (const task of tasks) {
        try {
            console.log(`..Generating ${task.section} / ${task.taskType}`);
            const qs = await generateQuestions(examType, task.section, task.taskType, task.count);
            allQuestions.push(...qs);
        } catch (err) {
            console.error(`Failed to generate ${task.taskType}, skipping.`);
        }
    }

    return allQuestions;
}
