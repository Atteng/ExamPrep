"use client";

import { useState } from "react";
import { QuestionData } from "@/types/question";
import { TestEngine } from "@/components/TestEngine/TestEngine";
import { saveExamResult } from "@/lib/db/actions";
import { TestResults } from "@/components/TestEngine/TestResults";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { BookOpen, Headphones, Mic, PenTool, PlayCircle, Loader2 } from "lucide-react";



const MOCK_QUESTIONS: QuestionData[] = [
    {
        id: "q1",
        examType: "toefl",
        section: "reading",
        taskType: "Read in Daily Life",
        prompt: "Read the email and answer the question.",
        text: "Hi John,\n\nI hope you're doing well. I was wondering if you could help me with the math assignment due tomorrow? I'm stuck on the last problem.\n\nThanks,\nSarah",
        options: [
            "Sarah wants John to do her homework.",
            "Sarah is asking for help with a specific problem.",
            "Sarah is inviting John to study together.",
            "Sarah is submitting her assignment."
        ],
        answerKey: "Sarah is asking for help with a specific problem.",
        metadata: {
            difficulty: "easy",
            estimatedTime: 60
        }
    }
];



export default function PracticePage() {
    const [selectedExam, setSelectedExam] = useState("toefl");
    const [selectedSection, setSelectedSection] = useState("reading");
    const [selectedTaskType, setSelectedTaskType] = useState("Read in Daily Life");
    const [practiceMode, setPracticeMode] = useState<'full' | 'section'>('full');
    const [testDifficulty, setTestDifficulty] = useState('practice');
    const [isTestActive, setIsTestActive] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [questions, setQuestions] = useState<QuestionData[]>(MOCK_QUESTIONS);

    // Results State
    const [showResults, setShowResults] = useState(false);
    const [finalResults, setFinalResults] = useState<any>(null);

    const handleStart = async () => {
        setIsGenerating(true);
        try {
            // Determine API payload
            const payload = practiceMode === 'full'
                ? { mode: 'full', difficulty: testDifficulty, examType: selectedExam }
                : {
                    mode: 'section',
                    examType: selectedExam,
                    section: selectedSection,
                    taskType: selectedTaskType,
                    count: 5
                };

            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Generation failed: ${res.status}`);
            }

            const data = await res.json();
            if (data.questions && data.questions.length > 0) {
                setQuestions(data.questions);
            } else {
                console.warn("No questions generated, using mock data.");
                setQuestions(MOCK_QUESTIONS);
            }

            setIsTestActive(true);
            setShowResults(false); // Reset results
        } catch (error: any) {
            console.error(error);
            alert(error.message || "Failed to generate test.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleExit = () => {
        setIsTestActive(false);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-6rem)]">

            {/* Mobile: If test active, show ONLY test engine (full screen overlay effect) */}
            <div className={cn(
                "flex-1 flex flex-col md:flex-row md:gap-6",
                isTestActive && "fixed inset-0 z-50 bg-background md:static md:z-auto"
            )}>

                {/* Left Sidebar: Selection (Hidden on Mobile if Test Active) */}
                <div className={cn(
                    "w-full md:w-80 p-4 md:p-0 flex-shrink-0 space-y-6 overflow-y-auto",
                    isTestActive && "hidden md:block" // Hide on mobile when test active
                )}>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight">Practice<br />Zone</h1>
                        <p className="text-muted-foreground">Select your target area.</p>
                    </div>

                    <div className="space-y-4">
                        {/* 1. Exam Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Exam Type</label>
                            <select
                                value={selectedExam}
                                onChange={(e) => setSelectedExam(e.target.value)}
                                className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="toefl">TOEFL iBT (New)</option>
                                <option value="gre">GRE General</option>
                                <option value="german">German B1/B2</option>
                            </select>
                        </div>

                        {/* 2. Mode Selection (Tabs) */}
                        <div className="grid grid-cols-2 p-1 bg-muted rounded-lg">
                            <button
                                onClick={() => setPracticeMode('full')}
                                className={cn(
                                    "py-1.5 text-sm font-medium rounded-md transition-all",
                                    practiceMode === 'full'
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Full Test
                            </button>
                            <button
                                onClick={() => setPracticeMode('section')}
                                className={cn(
                                    "py-1.5 text-sm font-medium rounded-md transition-all",
                                    practiceMode === 'section'
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Section Drill
                            </button>
                        </div>

                        {/* 3. Conditional Content based on Mode */}
                        {practiceMode === 'full' ? (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Difficulty</label>
                                    <div className="grid gap-2">
                                        {[
                                            { id: 'learning', label: 'Learning', desc: 'Easier mix to build confidence' },
                                            { id: 'practice', label: 'Standard', desc: 'Real exam difficulty' },
                                            { id: 'challenge', label: 'Challenge', desc: 'Hard C1/C2 questions' }
                                        ].map((mode) => (
                                            <button
                                                key={mode.id}
                                                onClick={() => setTestDifficulty(mode.id)}
                                                className={cn(
                                                    "flex flex-col items-start p-3 rounded-lg border text-left transition-all hover:bg-muted/50",
                                                    testDifficulty === mode.id
                                                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                        : "bg-card border-border"
                                                )}
                                            >
                                                <span className="text-sm font-semibold">{mode.label}</span>
                                                <span className="text-xs text-muted-foreground">{mode.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <label className="text-sm font-medium">Target Section</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: "reading", label: "Reading", icon: BookOpen },
                                        { id: "listening", label: "Listening", icon: Headphones },
                                        { id: "speaking", label: "Speaking", icon: Mic },
                                        { id: "writing", label: "Writing", icon: PenTool },
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => setSelectedSection(item.id)}
                                            className={cn(
                                                "flex flex-col items-center justify-center p-3 rounded-lg border text-sm transition-all hover:bg-muted",
                                                selectedSection === item.id
                                                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                                                    : "bg-card text-muted-foreground"
                                            )}
                                        >
                                            <item.icon className="w-5 h-5 mb-1" />
                                            {item.label}
                                        </button>
                                    ))
                                    }
                                </div>

                                {/* Task Type Selector (Reading & Speaking) */}
                                {selectedSection === 'reading' && (
                                    <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-sm font-medium">Task Type</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: "all", label: "Full Section", desc: "Mix of all tasks" },
                                                { id: "Read in Daily Life", label: "Daily Life", desc: "Short texts" },
                                                { id: "Complete The Words", label: "Complete Words", desc: "Cloze test" },
                                                { id: "Read an Academic Passage", label: "Academic", desc: "Long passage" },
                                            ].map((task) => (
                                                <button
                                                    key={task.id}
                                                    onClick={() => setSelectedTaskType(task.id)}
                                                    className={cn(
                                                        "flex flex-col items-start p-3 rounded-lg border text-left text-sm transition-all hover:bg-muted",
                                                        selectedTaskType === task.id
                                                            ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                                                            : "bg-card text-muted-foreground"
                                                    )}
                                                >
                                                    <span className="font-semibold">{task.label}</span>
                                                    <span className="text-xs opacity-80">{task.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedSection === 'listening' && (
                                    <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-sm font-medium">Task Type</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: "all", label: "Full Section", desc: "Mix of all tasks" },
                                                { id: "Listen to a Conversation", label: "Conversation", desc: "Campus dialogue" },
                                                { id: "Listen to an Announcement", label: "Announcement", desc: "Short notice" },
                                                { id: "Listen to an Academic Talk", label: "Academic Talk", desc: "Short lecture" },
                                            ].map((task) => (
                                                <button
                                                    key={task.id}
                                                    onClick={() => setSelectedTaskType(task.id)}
                                                    className={cn(
                                                        "flex flex-col items-start p-3 rounded-lg border text-left text-sm transition-all hover:bg-muted",
                                                        selectedTaskType === task.id
                                                            ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                                                            : "bg-card text-muted-foreground"
                                                    )}
                                                >
                                                    <span className="font-semibold">{task.label}</span>
                                                    <span className="text-xs opacity-80">{task.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedSection === 'speaking' && (
                                    <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-sm font-medium">Task Type</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: "all", label: "Full Section", desc: "7-8 Repeat + 4 Interview" },
                                                { id: "Listen and Repeat", label: "Listen & Repeat", desc: "Repeat sentences" },
                                                { id: "Take an Interview", label: "Interview", desc: "Answer questions" },
                                            ].map((task) => (
                                                <button
                                                    key={task.id}
                                                    onClick={() => setSelectedTaskType(task.id)}
                                                    className={cn(
                                                        "flex flex-col items-start p-3 rounded-lg border text-left text-sm transition-all hover:bg-muted",
                                                        selectedTaskType === task.id
                                                            ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                                                            : "bg-card text-muted-foreground"
                                                    )}
                                                >
                                                    <span className="font-semibold">{task.label}</span>
                                                    <span className="text-xs opacity-80">{task.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <button
                            onClick={handleStart}
                            disabled={isGenerating}
                            className="w-full flex items-center justify-center h-12 bg-primary text-primary-foreground rounded-md font-bold text-lg hover:bg-primary/90 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Generating Exam...
                                </>
                            ) : (
                                <>
                                    <PlayCircle className="w-5 h-5 mr-2" />
                                    Start Practice
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Area: Test Engine or Placeholder */}
                <div className="flex-1 bg-muted/20 md:border md:rounded-xl md:shadow-inner overflow-hidden relative">
                    {isTestActive ? (
                        <TestEngine
                            questions={questions}
                            timeLimit={(() => {
                                // Official TOEFL iBT Section Times
                                if (practiceMode === 'full') {
                                    // Full test mode - use total time (90 mins)
                                    return 90 * 60;
                                }

                                // Section Drill - Official Times for "Full Section"
                                if (selectedTaskType === 'all') {
                                    switch (selectedSection) {
                                        case 'reading':
                                            return 27 * 60; // 27 minutes (35-48 items)
                                        case 'listening':
                                            return 27 * 60; // 27 minutes (35-45 items)
                                        case 'speaking':
                                            return 8 * 60;  // 8 minutes (11 items)
                                        case 'writing':
                                            return 23 * 60; // 23 minutes (12 items)
                                        default:
                                            return 20 * 60;
                                    }
                                }

                                // Individual Task Type Times (proportional estimates)
                                switch (selectedTaskType) {
                                    case 'Read an Academic Passage':
                                        return 5 * 60;  // ~5 mins per passage
                                    case 'Read in Daily Life':
                                        return 3 * 60;  // ~3 mins per text
                                    case 'Complete The Words':
                                        return 3 * 60;  // ~3 mins per passage
                                    case 'Listen to a Conversation':
                                        return 3 * 60;  // ~3 mins (audio + questions)
                                    case 'Listen to an Announcement':
                                        return 3 * 60;  // ~3 mins
                                    case 'Listen to an Academic Talk':
                                        return 4 * 60;  // ~4 mins
                                    case 'Listen and Repeat':
                                        return 2 * 60;  // ~2 mins (7 sentences)
                                    case 'Take an Interview':
                                        return 5 * 60;  // ~5 mins (4 questions × 45s + intro)
                                    default:
                                        return 20 * 60; // Default fallback
                                }
                            })()}
                            title={practiceMode === 'full'
                                ? `Full ${selectedExam.toUpperCase()} Mock Test`
                                : `${selectedExam.toUpperCase()} ${selectedSection.charAt(0).toUpperCase() + selectedSection.slice(1)} Drill`}
                            examType={selectedExam}
                            section={selectedSection}
                            onExit={handleExit}
                            onComplete={async (results) => {
                                console.log("Grading and saving results...", results);
                                try {
                                    // 1. Get User
                                    const { data: { user } } = await supabase.auth.getUser();
                                    if (!user) {
                                        console.warn("No user logged in, cannot save results.");
                                        // Still allow them to see score locally if we implemented a results modal,
                                        // but for now just alert.
                                        alert("You are not logged in. Results will not be saved.");
                                        return;
                                    }

                                    // 2. Grade Each Answer
                                    // Note: In production, batch this or do it all server-side.
                                    let totalEarned = 0;
                                    let totalPossible = 0;
                                    const sectionScores = { reading: 0, listening: 0, speaking: 0, writing: 0 };
                                    const sectionCounts = { reading: 0, listening: 0, speaking: 0, writing: 0 };

                                    const gradedAnswers = await Promise.all(
                                        Object.entries(results).map(async ([questionId, answer]) => {
                                            // Find the question object
                                            const q = questions.find(q => q.id === questionId);
                                            if (!q) return null;

                                            const payload = {
                                                examType: selectedExam,
                                                section: q.section,
                                                taskType: q.taskType,
                                                question: q,
                                                userAnswer: answer
                                            };

                                            const res = await fetch('/api/grade', {
                                                method: 'POST',
                                                body: JSON.stringify(payload)
                                            });
                                            const grade = await res.json();

                                            return {
                                                ...grade,
                                                section: q.section,
                                                questionId
                                            };
                                        })
                                    );

                                    // 3. Aggregate Scores
                                    gradedAnswers.forEach(g => {
                                        if (!g) return;
                                        // Score is 0-100 normalized
                                        totalEarned += g.score;
                                        totalPossible += 100;

                                        // Section tracking
                                        if (sectionCounts[g.section as keyof typeof sectionCounts] !== undefined) {
                                            sectionScores[g.section as keyof typeof sectionCounts] += g.score;
                                            sectionCounts[g.section as keyof typeof sectionCounts] += 1;
                                        }
                                    });

                                    // Normalize to Exam Scale (e.g. TOEFL 120)
                                    // Simple logic: Average % * 120
                                    const rawPercentage = totalPossible > 0 ? (totalEarned / totalPossible) : 0;
                                    const finalScore = Math.round(rawPercentage * 120);

                                    // Normalize Sections (0-30 scale for TOEFL)
                                    const finalSectionScores = {
                                        reading: sectionCounts.reading ? Math.round((sectionScores.reading / (sectionCounts.reading * 100)) * 30) : 0,
                                        listening: sectionCounts.listening ? Math.round((sectionScores.listening / (sectionCounts.listening * 100)) * 30) : 0,
                                        speaking: sectionCounts.speaking ? Math.round((sectionScores.speaking / (sectionCounts.speaking * 100)) * 30) : 0,
                                        writing: sectionCounts.writing ? Math.round((sectionScores.writing / (sectionCounts.writing * 100)) * 30) : 0,
                                    };

                                    // 4. Save to Supabase
                                    await saveExamResult({
                                        user_id: user.id,
                                        exam_type: selectedExam as any,
                                        total_score: finalScore,
                                        max_score: 120,
                                        test_date: new Date().toISOString(),
                                        section_scores: finalSectionScores,
                                        metadata: {
                                            mode: practiceMode,
                                            difficulty: testDifficulty,
                                            // Store detailed feedback if needed (would need schema update for details)
                                        }
                                    });

                                    console.log("Result saved successfully!", finalScore);

                                    // Show Results UI
                                    setFinalResults({
                                        totalScore: finalScore,
                                        maxScore: 120,
                                        sectionScores: finalSectionScores,
                                        gradedItems: gradedAnswers
                                    });
                                    setShowResults(true);

                                } catch (error) {
                                    console.error("Failed to save result:", error);
                                    alert("Failed to grade/save results. Please check console.");
                                }
                            }}
                        />
                    ) : (
                        <div className="hidden md:flex flex-col items-center justify-center h-full text-muted-foreground space-y-4 p-8 text-center">
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                <PlayCircle className="w-8 h-8 opacity-50" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">Ready to start?</h3>
                                <p>Select an exam and section from the left to begin your session.</p>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
