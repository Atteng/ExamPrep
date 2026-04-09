import { shuffleArray } from "@/lib/utils/shuffle";

import { model, generateWithRetry } from "../gemini";
import { validateQuestion } from "../validators/questionValidator";
import { QuestionData, ExamType, SectionType } from "@/types/question";
import { TestTemplate } from "./testTemplates";
import { TOEFL_PROMPT, GRE_PROMPT, GERMAN_PROMPT } from "./promptTemplates";
import toeflData from "@/data/toefl_source_data.json";
import { getLibraryContent, saveLibraryContent, findGlobalQuestions, saveGeneratedQuestions } from "@/lib/db/actions";
import { createHash } from "crypto";

export type GenerationMode = 'balanced' | 'fresh' | 'fast';

function computeFingerprint(q: QuestionData): string {
    const payload = {
        examType: q.examType,
        section: q.section,
        taskType: q.taskType,
        prompt: q.prompt,
        text: q.text,
        context: q.context,
        options: q.options,
        questions: q.questions?.map(sq => ({
            prompt: sq.prompt,
            options: sq.options
        }))
    };
    return createHash('sha1').update(JSON.stringify(payload)).digest('hex');
}

function shouldUseCache(mode: GenerationMode) {
    if (mode === 'fresh') return false;
    if (mode === 'fast') return true;
    // balanced: prefer a mix of new + cached content
    return Math.random() >= 0.5;
}

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
// Implements TOEFL New Format spec:
//   - First sentence is ALWAYS left intact
//   - Starting from sentence 2: delete second half of every 2nd word (min 4 chars)
//   - Visible portion = Math.floor(length / 2) characters
//   - Blanks are tight underscores: e.g. "mi___" (one _ per missing letter, no spaces)
//   - Hard cap of exactly 10 deletions
const MAX_CLOZE_DELETIONS = 10;

function applyClozeMasking(text: string) {
    // Split into sentences to protect the first sentence
    const firstSentenceEnd = text.search(/[.!?]\s/);
    const firstSentence = firstSentenceEnd !== -1 ? text.slice(0, firstSentenceEnd + 1) : '';
    const remaining = firstSentenceEnd !== -1 ? text.slice(firstSentenceEnd + 1).trim() : text;

    // Tokenise: split by whitespace but keep the whitespace tokens for faithful reconstruction
    const tokens = remaining.split(/(\s+)/);

    const maskedTokens: string[] = [];
    const answerParts: string[] = [];
    let maskedCount = 0;
    let wordCount = 0;

    for (const token of tokens) {
        // Whitespace or empty — pass through unchanged
        if (/^\s*$/.test(token)) {
            maskedTokens.push(token);
            continue;
        }

        wordCount++;
        const isTargetWord = wordCount % 2 === 0; // every 2nd word

        // Separate trailing punctuation from the word itself
        const match = token.match(/^([a-zA-Z']+)([.,!?;:"]*)$/);
        const cleanWord = match?.[1] ?? token;
        const punctuation = match?.[2] ?? '';

        if (isTargetWord && maskedCount < MAX_CLOZE_DELETIONS && cleanWord.length >= 4) {
            const halfPoint = Math.floor(cleanWord.length / 2); // spec: show first floor(n/2) chars
            const visible = cleanWord.slice(0, halfPoint);
            const hidden = cleanWord.slice(halfPoint);
            const blanks = '_'.repeat(hidden.length); // tight, no spaces

            maskedTokens.push(`${visible}${blanks}${punctuation}`);
            answerParts.push(`(${maskedCount + 1}) ${hidden}`);
            maskedCount++;
        } else {
            maskedTokens.push(token);
        }
    }

    return {
        maskedText: (firstSentence + ' ' + maskedTokens.join('')).trim(),
        answerKey: answerParts.join(' '),
    };
}

// Helper: Random Topic Generator
function getRandomTopic(exclude: string[] = []) {
    const topics = [
        // Original Topics
        "Campus Life", "Modern History", "Environmental Science",
        "Art History", "Psychology", "Technology", "Economics", "Astronomy",
        "Architecture", "Biology", "Literature", "Marketing", "Geology",
        "Anthropology", "Computer Science", "Linguistics",
        // Expanded Topics for Variety
        "Quantum Physics", "Marine Biology", "Ancient Civilizations", "Philosophy",
        "Neuroscience", "Climate Change", "Artificial Intelligence", "Music Theory",
        "Political Science", "Sociology", "World Religions", "Chemistry",
        "Robotics", "Genetics", "Urban Planning", "Journalism",
        "Public Health", "Renewable Energy", "Space Exploration", "Cryptography"
    ];

    // Filter available topics
    const available = topics.filter(t => !exclude.includes(t));

    // If all excluded, fall back to full list to avoid crash
    const pool = available.length > 0 ? available : topics;

    return pool[Math.floor(Math.random() * pool.length)];
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
    aiPrompt: string,
    generationMode: GenerationMode = 'balanced'
): Promise<{ text: string, source: 'official-seed' | 'ai-generated' }> {
    // 1. Try Cache
    if (shouldUseCache(generationMode)) try {
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
    count: number = 1,
    excludeTopics: string[] = [], // Phase 16: History Tracking
    difficulty: string = 'B2', // Adaptive Level (B1/B2/C1/C2)
    generationMode: GenerationMode = 'balanced'
): Promise<QuestionData[]> {
    const sourceTask = getSourceData(taskType);

    // Smart Context
    const topic = getRandomTopic(excludeTopics);
    const level = difficulty; // Use the passed difficulty

    // --- SHARED LIBRARY CHECK ---
    // 1. Try to find existing questions in the global pool that match criteria
    console.log(`🔍 Searching Global Library for [${taskType}]...`);
    // Assume search returns random set of matching questions
    const existingQuestions = shouldUseCache(generationMode)
        ? await findGlobalQuestions(examType, section, taskType, count, difficulty)
        : [];

    // Filter cached questions by excluded topics
    const filteredQuestions = existingQuestions.filter(q => {
        const questionTopic = q.metadata?.originalTopic;
        return !questionTopic || !excludeTopics.includes(questionTopic);
    });

    // Validate cached questions to avoid serving malformed sets
    const validatedCached = filteredQuestions.filter(q => {
        try {
            return validateQuestion(q).valid;
        } catch {
            return false;
        }
    });

    console.log(`✅ FOUND ${existingQuestions.length} cached questions, ${validatedCached.length} after validation/topic filtering.`);

    // If we have enough after filtering, return them
    if (validatedCached.length >= count) {
        // IMPORTANT: Shuffle options for cached questions too!
        const shuffledExisting = validatedCached.map(q => {
            if (q.options && q.options.length > 0) {
                return {
                    ...q,
                    options: shuffleArray(q.options)
                };
            }
            // Handle nested questions (Listening passages)
            if (q.questions && q.questions.length > 0) {
                return {
                    ...q,
                    questions: q.questions.map((subQ: any) => {
                        if (subQ.options && subQ.options.length > 0) {
                            return { ...subQ, options: shuffleArray(subQ.options) };
                        }
                        return subQ;
                    })
                };
            }
            return q;
        });

        return shuffledExisting.slice(0, count);
    }

    // Declare needed at the top of scope
    let needed = 0;
    let newQuestions: QuestionData[] = [];

    // If we have SOME filtered questions but not enough, use them and generate the rest
    if (validatedCached.length > 0) {
        console.log(`⚠️ Only ${validatedCached.length} valid cached questions. Generating ${count - validatedCached.length} more.`);
        // Update 'needed' to reflect what we still need after using filtered cache
        needed = count - validatedCached.length;
        // Add the filtered questions to our result set
        const shuffledPartial = validatedCached.map(q => {
            if (q.options && q.options.length > 0) {
                return { ...q, options: shuffleArray(q.options) };
            }
            if (q.questions && q.questions.length > 0) {
                return {
                    ...q,
                    questions: q.questions.map((subQ: any) => {
                        if (subQ.options && subQ.options.length > 0) {
                            return { ...subQ, options: shuffleArray(subQ.options) };
                        }
                        return subQ;
                    })
                };
            }
            return q;
        });
        newQuestions.push(...shuffledPartial);
    } else {
        // Otherwise, calculate how many MORE we need (no valid cached questions at all)
        needed = count;
        console.log(`⚠️ NO VALID CACHED QUESTIONS after topic filtering. Generating ${needed} new via AI...`);
    }

    // --- GENERATION STRATEGIES ---

    // STRATEGY A: HYBRID (Complete The Words)
    if (taskType === 'complete_words' || taskType === 'Complete The Words') {
        const { text, source } = await fetchOrGenerateContent(
            'reading_passage_cloze',
            topic,
            level,
            `Write an academic paragraph about ${topic} for an English proficiency test.
Requirements:
- CEFR Level ${level}
- Length: 70 to 100 words (strict)
- Must be at least 3 sentences long
- The FIRST sentence must be a complete, fully grammatical opening sentence that introduces the topic
- Remaining sentences should flow naturally and use academic vocabulary
- Do NOT use headers, bullet points, or lists
- Output ONLY the raw paragraph text, nothing else`,
            generationMode
        );

        // Sanitize text
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

        newQuestions.push({
            id: crypto.randomUUID(),
            examType: examType as ExamType,
            section: section as SectionType,
            taskType: "Complete The Words",
            prompt: "Complete the missing letters in the following passage:",
            text: processed.maskedText,
            answerKey: processed.answerKey,
            metadata: { source, difficulty: 'hard' as const, originalTopic: topic }
        });
    }

    // STRATEGY B: HYBRID (Reading/Speaking with Context)
    else if (
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
        if (contentType === 'speaking_sentence') promptText = `Write ${needed} simple academic sentences for a 'Listen and Repeat' test. Topics: ${topic}. Level: ${level}. Output: JSON array of strings.`;
        else if (contentType === 'speaking_interview_question') promptText = `Write ${needed} open-ended interview questions about ${topic}. Level: ${level}. Output: JSON array of strings.`;
        else {
            const isLongData = needed >= 5;
            const length = isLongData ? "400-500" : "150-200";
            promptText = `Write a ${contentType.includes('daily') ? 'real-world text (e.g. email, ad)' : 'academic passage'} about ${topic}. Requirements: CEFR ${level}, ${length} words.`;
        }

        const { text, source } = await fetchOrGenerateContent(
            contentType,
            topic,
            level,
            promptText,
            generationMode
        );

        // 2. Process Content into Question Objects
        if (section === 'speaking') {
            let items: string[] = [];
            try {
                if (text.trim().startsWith('[')) {
                    items = JSON.parse(text);
                } else {
                    items = text.split('\n').filter(l => l.trim().length > 10);
                }
            } catch (e) { items = [text]; }

            const generatedItems = items.slice(0, needed).map((item, idx) => ({
                id: crypto.randomUUID(),
                examType: examType as ExamType,
                section: section as SectionType,
                taskType: taskType,
                prompt: taskType.includes('Repeat') ? "Repeat the sentence exactly." : "Answer the question.",
                text: item,
                answerKey: "N/A - Subjective Grading",
                metadata: { source, difficulty: 'medium' as const, originalTopic: topic }
            }));
            newQuestions.push(...generatedItems);
        } else {
            // Reading logic
            const hybridPrompt = `
            CONTEXT TEXT:
            """${text}"""
    
            TASK:
            Generate ${needed} multiple-choice question(s) based on the text above.
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
            - Include the full text in the 'text' field for every question object.
            `;

            try {
                const result = await generateWithRetry(async () => await model.generateContent(hybridPrompt));
                const raw = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(raw) as QuestionData[];

                const validated = parsed.map(q => ({
                    ...q,
                    id: crypto.randomUUID(),
                    text: text, // Use fetched text
                    metadata: { ...q.metadata, source, originalTopic: topic }
                }));
                newQuestions.push(...validated);
            } catch (e) {
                console.error("Hybrid Reading Gen Failed:", e);
                // Fallthrough implies returning empty newQuestions -> error handling or retry might be needed
            }
        }
    }

    // STRATEGY B.2: Contextual Sentence Building (Dialogue)
    else if (taskType === 'Build a Sentence' || taskType === 'build_sentence') {
        const buildSentencePrompt = `
        TASK:
        Generate ${needed} "Build a Sentence" reading/writing tasks.
        Topic: ${topic}
        Level: ${level}

        REQUIREMENTS:
        1. Context: Provide a short question or statement from "Person A".
        2. Answer: Provide a grammatically correct response from "Person B" (You).
        3. Scramble: Break the response into 6-10 shuffled words/phrases.
        4. Frame: (Optional) If the response has a fixed start/end, specify it.

        JSON OUTPUT FORMAT:
        [{
          "id": "uuid",
          "examType": "${examType}",
          "section": "writing",
          "taskType": "Build a Sentence",
          "prompt": "Make an appropriate sentence.", 
          "structure": {
             "context": "Person A: What was the highlight of your trip?",
             "example": {
                 "scrambled_parts": ["were", "the", "was", "old city", "showed us around", "who", "tour guides"]
             }
          },
          "answerKey": "The tour guides who showed us around the old city were fantastic."
        }]
        `;

        try {
            const result = await generateWithRetry(async () => await model.generateContent(buildSentencePrompt));
            const raw = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(raw) as QuestionData[];

            const validated = parsed.map(q => ({
                ...q,
                id: crypto.randomUUID(),
                metadata: { source: 'ai-generated' as const, difficulty: 'medium' as const, originalTopic: topic }
            }));
            newQuestions.push(...validated);

        } catch (e) {
            console.error("Build Sentence Context Generation Failed:", e);
        }
    }

    // STRATEGY B.3: Listen and Choose a Response (Short Audio -> 1 Question)
    else if (taskType === 'Listen and Choose a Response' || taskType === 'listening_choose_response') {
        const chooseResponsePrompt = `
        TASK:
        Generate ${needed} "Listen and Choose a Response" items.
        
        CONTEXT:
        - Setting: Campus Life (Library, Dormitory, Professor's Office, Dining Hall, Registrar).
        - Speakers: Student to Student OR Student to Professor.
        - Skill: Recognition of implied meaning, idiomatic expressions, and socially appropriate responses.

        REQUIREMENTS:
        1. Audio Text: A single short question or statement (1-2 sentences). NOT written on screen.
           - Must use natural spoken English (contractions, "Um", "Actually").
           - ABSOLUTELY NO SPEAKER LABELS like "Speaker:" or "Person A:" in the text field.
           - Example: "Didn't I just see you in the library an hour ago?"
        2. Prompt: "Choose the best response."
        3. Options: 4 possible responses (A, B, C, D).
           - Correct: Logically and socially appropriate response (often addresses the *implication* not just the literal words).
           - Distractor 1 (Keyword Trap): Uses words from the audio (e.g. "library") but effectively nonsense or wrong context.
           - Distractor 2 (Time/Location Trap): Mentions time/place incorrectly.
           - Distractor 3 (Opposite/Irrelevant): Completely wrong.

        JSON OUTPUT FORMAT:
        [{
          "id": "uuid",
          "examType": "${examType}",
          "section": "listening",
          "taskType": "Listen and Choose a Response",
          "prompt": "Choose the best response to the statement.", 
          "text": "I doubt I'll be able to finish this paper by the deadline.",
          "options": ["You should ask the professor for an extension.", "The deadline is on Friday.", "I have plenty of paper.", "Yes, I finished it yesterday."],
          "answerKey": "You should ask the professor for an extension."
        }]
        `;

        try {
            const validNew: QuestionData[] = [];
            for (let attempt = 0; attempt < 3 && validNew.length < needed; attempt++) {
                const remaining = needed - validNew.length;
                const prompt = chooseResponsePrompt.replace(`Generate ${needed}`, `Generate ${remaining}`);
                const result = await generateWithRetry(async () => await model.generateContent(prompt));
                const raw = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(raw) as QuestionData[];

                const mapped = parsed.map(q => {
                    if (q.options && q.options.length > 0) {
                        const correctAnswer = q.answerKey;
                        const shuffled = shuffleArray(q.options);
                        return {
                            ...q,
                            id: crypto.randomUUID(),
                            options: shuffled,
                            answerKey: correctAnswer,
                            metadata: { source: 'ai-generated' as const, difficulty: 'medium' as const, originalTopic: topic }
                        };
                    }
                    return {
                        ...q,
                        id: crypto.randomUUID(),
                        metadata: { source: 'ai-generated' as const, difficulty: 'medium' as const, originalTopic: topic }
                    };
                });

                for (const q of mapped) {
                    const vr = validateQuestion(q);
                    if (vr.valid) {
                        validNew.push(q);
                    } else {
                        console.warn(`⚠️ [Listen & Choose] Rejected question (score ${vr.score}):`, vr.errors.join('; '));
                    }
                }
            }

            newQuestions.push(...validNew.slice(0, needed));

        } catch (e) {
            console.error("Listen & Choose Gen Failed:", e);
        }
    }

    // STRATEGY C: LISTENING (Multi-Question Sets)
    else if (section === 'listening') {
        const difficulty = 'medium';
        const questionsPerPassage = taskType.includes('Academic') ? 4 : 3;

        const listeningPrompt = `
        TASK:
        Generate ${needed} Listening Passage(s) for task type: "${taskType}".
        Topic: ${topic}
        Level: ${level}

        REQUIREMENTS:
        1. Context: ${taskType.includes('Conversation') ? 'A dialogue.' : 'A monologue.'}
        2. Questions: Generate ${questionsPerPassage} questions per passage.
        3. Transcripts: Included.

        JSON OUTPUT FORMAT (Array of Objects):
        [{
          "id": "uuid",
          "examType": "${examType}",
          "section": "listening",
          "taskType": "${taskType}",
          "prompt": "Listen to the ${taskType.includes('Conversation') ? 'conversation' : 'announcement'}...", 
          "text": "Full transcript...",
          "questions": [
            {
              "prompt": "What is the main topic?",
              "options": ["A", "B", "C", "D"],
              "answerKey": "Correct option text"
            }
          ]
        }]
        
        CRITICAL: Each question in the "questions" array MUST have:
        - "prompt": The actual question text (e.g., "What is the main purpose?")
        - "options": Array of 4 answer choices
        - "answerKey": The correct answer text
        `;

        try {
            const validNew: QuestionData[] = [];
            for (let attempt = 0; attempt < 3 && validNew.length < needed; attempt++) {
                const remaining = needed - validNew.length;
                const prompt = listeningPrompt.replace(`Generate ${needed} Listening Passage(s)`, `Generate ${remaining} Listening Passage(s)`);
                const result = await generateWithRetry(async () => await model.generateContent(prompt));
                const raw = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(raw) as QuestionData[];

                const mapped = parsed.map(q => {
                    if (q.questions && q.questions.length > 0) {
                        const shuffledQuestions = q.questions.map((subQ: any) => {
                            if (subQ.options && subQ.options.length > 0) {
                                return { ...subQ, options: shuffleArray(subQ.options) };
                            }
                            return subQ;
                        });

                        return {
                            ...q,
                            id: crypto.randomUUID(),
                            questions: shuffledQuestions,
                            metadata: { source: 'ai-generated' as const, difficulty: 'medium' as const, originalTopic: topic }
                        };
                    }

                    return {
                        ...q,
                        id: crypto.randomUUID(),
                        metadata: { source: 'ai-generated' as const, difficulty: 'medium' as const, originalTopic: topic }
                    };
                });

                for (const q of mapped) {
                    const vr = validateQuestion(q);
                    if (vr.valid) {
                        validNew.push(q);
                    } else {
                        console.warn(`⚠️ [Listening Set] Rejected question (score ${vr.score}):`, vr.errors.join('; '));
                    }
                }
            }

            newQuestions.push(...validNew.slice(0, needed));

        } catch (e) {
            console.error("Listening Generation Failed:", e);
        }
    }

    // STRATEGY D: STANDARD AI GENERATION (Legacy)
    else {
        let promptTemplate = "";
        switch (examType.toLowerCase()) {
            case 'gre': promptTemplate = GRE_PROMPT; break;
            case 'german': promptTemplate = GERMAN_PROMPT; break;
            case 'toefl': default: promptTemplate = TOEFL_PROMPT; break;
        }

        const hydratedPrompt = promptTemplate
            .replace('${count}', needed.toString())
            .replace('${taskType}', taskType)
            .replace('${section}', section)
            .replace('${topic}', topic)
            .replace('${level}', level)
            .replace('${reference}', JSON.stringify(sourceTask || {}, null, 2));

        const finalPrompt = `
        ${hydratedPrompt}
        
        GLOBAL REQUIREMENTS:
        1. Generate new content.
        2. Strict JSON.
        3. Output Array of Objects.
        
        JSON SCHEMA:
        [{
          "id": "uuid",
          "examType": "${examType}",
          "section": "${section}",
          "taskType": "${taskType}",
          "prompt": "Prompt...",
          "text": "Text...",
          "options": ["A", "B", "C", "D"],
          "answerKey": "Correct Option"
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
                return validation.valid;
            });

            const mapped = validQuestions.map(q => ({
                ...q,
                id: q.id || crypto.randomUUID(),
                examType: examType as ExamType,
                section: section as SectionType,
                taskType
            }));
            newQuestions.push(...mapped);

        } catch (error) {
            console.error("AI Generation Error:", error);
            // Don't throw if we have some existing questions, just return what we have?
            // If newQuestions is empty and existing is empty, then throw.
        }
    }

    // --- SAVE TO GLOBAL POOL ---
    if (newQuestions.length > 0) {
        console.log(`💾 Saving ${newQuestions.length} new questions to Global Library...`);
        // Attach a stable-ish fingerprint for local duplicate blocking.
        newQuestions = newQuestions.map(q => ({
            ...q,
            metadata: {
                ...q.metadata,
                fingerprint: q.metadata?.fingerprint || computeFingerprint(q)
            }
        }));

        // Map to DB format: { exam_type, section, content }
        const dbPayload = newQuestions.map(q => ({
            exam_type: q.examType,
            section: q.section,
            content: q
        }));
        await saveGeneratedQuestions(dbPayload);
    }

    // Check if we have enough total — use validatedCached (not raw existingQuestions)
    // to avoid returning malformed or topic-excluded items.
    const total = [...validatedCached, ...newQuestions].map(q => ({
        ...q,
        metadata: {
            ...q.metadata,
            fingerprint: q.metadata?.fingerprint || computeFingerprint(q)
        }
    }));
    if (total.length === 0) {
        throw new Error(`Failed to generate or retrieve any questions for taskType="${taskType}" section="${section}" examType="${examType}".`);
    }

    return total;
}

export async function generateFullTest(
    template: TestTemplate,
    examType: string = 'toefl',
    difficulty: string = 'B2',
    generationMode: GenerationMode = 'balanced'
): Promise<QuestionData[]> {
    console.log(`🚀 Starting Full Test Generation [Mode: ${template.mode}, Level: ${difficulty}]`);
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
            console.log(`..Generating ${task.section} / ${task.taskType} [${difficulty}]`);
            // Pass the difficulty level explicitly
            const qs = await generateQuestions(examType, task.section, task.taskType, task.count, [], difficulty, generationMode);

            // TOEFL Reading/Listening are multistage (Module 1 routing -> Module 2).
            // Mark full-test generated Reading/Listening items as Module 1 so the session hook can trigger Module 2 generation.
            const mapped =
                examType === 'toefl' && (task.section === 'reading' || task.section === 'listening')
                    ? qs.map(q => ({
                        ...q,
                        metadata: {
                            ...q.metadata,
                            module: 1 as 1 | 2,
                            moduleType: 'routing' as 'routing' | 'easy' | 'hard'
                        }
                    }))
                    : qs;

            allQuestions.push(...mapped);
        } catch (err) {
            console.error(`Failed to generate ${task.taskType}, skipping.`);
        }
    }

    return allQuestions;
}
