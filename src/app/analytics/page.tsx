"use client";

import { useState, useEffect } from "react";
import { BarChart3, Calendar, Target, TrendingUp, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { getUserResults } from "@/lib/db/actions";
import { ExamType } from "@/types/question";

interface ScoreData {
    id: string;
    examType: ExamType;
    section: string;
    testDate: string;
    totalScore: number;
    maxScore: number;
    scores: {
        reading?: number;
        listening?: number;
        speaking?: number;
        writing?: number;
        verbal?: number;
        quantitative?: number;
        analytical?: number;
    };
}

// ... (existing imports)

export default function AnalyticsPage() {
    const [selectedExam, setSelectedExam] = useState<ExamType>('toefl');
    const [selectedResultId, setSelectedResultId] = useState<string>('');
    const [testResults, setTestResults] = useState<ScoreData[]>([]);

    useEffect(() => {
        async function loadData() {
            try {
                // 1. Check for active user
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    // 2. Fetch real data
                    const realResults = await getUserResults(user.id);

                    // 3. Transform to UI Model
                    const mappedData: ScoreData[] = realResults.map(r => ({
                        id: r.id || '',
                        examType: r.exam_type as ExamType,
                        section: 'full', // Defaulting for now
                        testDate: r.test_date || new Date().toISOString(),
                        totalScore: r.total_score,
                        maxScore: r.max_score,
                        scores: {
                            reading: r.section_scores['reading'],
                            listening: r.section_scores['listening'],
                            speaking: r.section_scores['speaking'],
                            writing: r.section_scores['writing'],
                            verbal: r.section_scores['verbal'],
                            quantitative: r.section_scores['quantitative'],
                            analytical: r.section_scores['analytical'],
                        }
                    }));
                    setTestResults(mappedData);
                } else {
                    // 4. Fallback to Mock Data (Demo Mode)
                    console.log("No user found, using mock data");
                    const mockData: ScoreData[] = [
                        {
                            id: '1',
                            examType: 'toefl',
                            section: 'full',
                            testDate: '2026-01-18',
                            totalScore: 98,
                            maxScore: 120,
                            scores: { reading: 26, listening: 24, speaking: 23, writing: 25 }
                        },
                        {
                            id: '2',
                            examType: 'toefl',
                            section: 'full',
                            testDate: '2026-01-15',
                            totalScore: 92,
                            maxScore: 120,
                            scores: { reading: 24, listening: 22, speaking: 24, writing: 22 }
                        }
                    ];
                    setTestResults(mockData);
                }
            } catch (err) {
                console.error("Failed to load analytics:", err);
            }
        }

        loadData();
    }, []);

    // Filter results for the selected exam
    const examResults = testResults.filter(r => r.examType === selectedExam);

    // Get currently selected result or fallback to latest
    const currentResult = examResults.find(r => r.id === selectedResultId) || examResults[0];

    // Update selected ID when exam changes
    useEffect(() => {
        if (examResults.length > 0) {
            setSelectedResultId(examResults[0].id);
        } else {
            setSelectedResultId('');
        }
    }, [selectedExam, testResults]);

    return (
        <div className="min-h-screen bg-background">
            <div className="container max-w-7xl mx-auto p-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
                    <p className="text-muted-foreground mt-2">Track your performance across all exams</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
                            <div>
                                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Select Exam</label>
                                <select
                                    value={selectedExam}
                                    onChange={(e) => setSelectedExam(e.target.value as ExamType)}
                                    className="w-full mt-2 px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="toefl">TOEFL iBT</option>
                                    <option value="gre">GRE General</option>
                                    <option value="german">German (Goethe)</option>
                                </select>
                            </div>

                            {/* Result Selector - Only show if there are results */}
                            {examResults.length > 0 && (
                                <div>
                                    <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Select Result</label>
                                    <select
                                        value={selectedResultId}
                                        onChange={(e) => setSelectedResultId(e.target.value)}
                                        className="w-full mt-2 px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        {examResults.map((result, idx) => (
                                            <option key={result.id} value={result.id}>
                                                {idx === 0 ? 'Latest' : new Date(result.testDate).toLocaleDateString()} - Score: {result.totalScore}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="bg-card border rounded-xl p-4 shadow-sm">
                            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Stats</div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">Tests Taken</span>
                                    <span className="text-lg font-bold">{examResults.length}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">Study Hours</span>
                                    <span className="text-lg font-bold">18.5h</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3 space-y-6">
                        {!currentResult ? (
                            <div className="bg-card border rounded-xl p-12 shadow-sm text-center">
                                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                                <h3 className="text-xl font-semibold mb-2">No {selectedExam.toUpperCase()} Results Yet</h3>
                                <p className="text-muted-foreground mb-6">Complete a practice test to see analytics here.</p>
                                <a href="/practice" className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors">
                                    Take Practice Test
                                </a>
                            </div>
                        ) : (
                            <>
                                {/* Meta Bar */}
                                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground bg-muted/30 px-4 py-3 rounded-lg">
                                    <span>Exam Type: <span className="font-semibold text-foreground">{selectedExam.toUpperCase()}</span></span>
                                    <span>Test Date: <span className="font-semibold text-foreground">{new Date(currentResult.testDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></span>
                                    <span>Result ID: <span className="font-semibold text-foreground">{currentResult.id}</span></span>
                                </div>

                                {/* Score Card */}
                                <div className="bg-card border rounded-xl p-8 shadow-sm">
                                    <div className="flex flex-col md:flex-row items-center gap-8">
                                        {/* Circular Progress */}
                                        <div className="relative w-48 h-48 flex-shrink-0">
                                            <svg className="transform -rotate-90 w-full h-full">
                                                <circle
                                                    cx="96" cy="96" r="70"
                                                    stroke="currentColor"
                                                    strokeWidth="12"
                                                    fill="none"
                                                    className="text-muted opacity-20"
                                                />
                                                <circle
                                                    cx="96" cy="96" r="70"
                                                    stroke="currentColor"
                                                    strokeWidth="12"
                                                    fill="none"
                                                    strokeDasharray={440}
                                                    strokeDashoffset={440 - (440 * currentResult.totalScore / currentResult.maxScore)}
                                                    className="text-primary transition-all duration-1000"
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Score</span>
                                                <span className="text-4xl font-bold mt-1">{currentResult.totalScore}</span>
                                                <span className="text-sm text-muted-foreground">out of {currentResult.maxScore}</span>
                                            </div>
                                        </div>

                                        {/* Section Scores */}
                                        <div className="flex-1 grid grid-cols-2 gap-4 w-full">
                                            {selectedExam === 'toefl' && (
                                                <>
                                                    {renderSectionBox('Reading', currentResult.scores.reading || 0, 30)}
                                                    {renderSectionBox('Listening', currentResult.scores.listening || 0, 30)}
                                                    {renderSectionBox('Speaking', currentResult.scores.speaking || 0, 30)}
                                                    {renderSectionBox('Writing', currentResult.scores.writing || 0, 30)}
                                                </>
                                            )}
                                            {selectedExam === 'gre' && (
                                                <>
                                                    {renderSectionBox('Verbal', currentResult.scores.verbal || 0, 170)}
                                                    {renderSectionBox('Quantitative', currentResult.scores.quantitative || 0, 170)}
                                                    {renderSectionBox('Writing', currentResult.scores.analytical || 0, 6.0)}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* SuperScore Card (TOEFL only) */}
                                {selectedExam === 'toefl' && examResults.length > 1 && (
                                    <div className="bg-gradient-to-br from-gray-900 to-black text-white border rounded-xl p-8 shadow-lg">
                                        <div className="flex flex-col md:flex-row gap-8">
                                            <div className="md:w-1/3 flex flex-col justify-center">
                                                <div className="text-sm opacity-70 uppercase tracking-wide mb-2">Sum of Highest Section Scores</div>
                                                <div className="text-6xl font-bold mb-2">{calculateSuperScore(examResults)}</div>
                                                <div className="text-sm opacity-70">out of 120</div>
                                            </div>
                                            <div className="md:w-2/3">
                                                <div className="text-sm mb-4 opacity-80">Your highest section scores from all {examResults.length} test(s) on record</div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {renderSuperScoreSection('Reading (0-30)', getBestScore(examResults, 'reading'))}
                                                    {renderSuperScoreSection('Listening (0-30)', getBestScore(examResults, 'listening'))}
                                                    {renderSuperScoreSection('Speaking (0-30)', getBestScore(examResults, 'speaking'))}
                                                    {renderSuperScoreSection('Writing (0-30)', getBestScore(examResults, 'writing'))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function renderSectionBox(title: string, score: number, max: number) {
    return (
        <div className="bg-muted/30 rounded-lg p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{title}</div>
            <div className="text-3xl font-bold mb-1">{score}</div>
            <div className="text-xs text-muted-foreground">out of {max}</div>
        </div>
    );
}

function renderSuperScoreSection(title: string, score: number) {
    return (
        <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs opacity-70 mb-1">{title}</div>
            <div className="text-2xl font-bold">{score}</div>
        </div>
    );
}

function calculateSuperScore(results: ScoreData[]): number {
    const best = {
        reading: Math.max(...results.map(r => r.scores.reading || 0)),
        listening: Math.max(...results.map(r => r.scores.listening || 0)),
        speaking: Math.max(...results.map(r => r.scores.speaking || 0)),
        writing: Math.max(...results.map(r => r.scores.writing || 0))
    };
    return best.reading + best.listening + best.speaking + best.writing;
}

function getBestScore(results: ScoreData[], section: string): number {
    return Math.max(...results.map(r => (r.scores as any)[section] || 0));
}
