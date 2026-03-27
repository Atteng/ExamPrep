"use client";

import { useState, useEffect } from "react";
import { BarChart3, Calendar, Target, TrendingUp, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { getUserResults } from "@/lib/db/actions";
import { ExamType } from "@/types/question";
import { TestResults } from "@/components/TestEngine/TestResults";
import { roundToNearestHalf } from "@/lib/scoring/toefl2026";

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
    metadata?: any;
}

function isWithinLastTwoYears(testDateIso: string) {
    const d = new Date(testDateIso);
    const now = new Date();
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setFullYear(now.getFullYear() - 2);
    return d >= twoYearsAgo && d <= now;
}

// ... (existing imports)

export default function AnalyticsPage() {
    const [selectedExam, setSelectedExam] = useState<ExamType>('toefl');
    const [selectedResultId, setSelectedResultId] = useState<string>('');
    const [testResults, setTestResults] = useState<ScoreData[]>([]);
    const [showReview, setShowReview] = useState(false);
    // TOEFL iBT (updated format): primary score scale is 1–6 (0.5 increments).
    // Keep a legacy 0–120 view for older stored results / temporary concordance.
    const [displayMode, setDisplayMode] = useState<'six_scale' | 'legacy_120'>('six_scale');

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
                        },
                        metadata: r.metadata
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
                            totalScore: 4,
                            maxScore: 6,
                            scores: { reading: 4, listening: 4, speaking: 4, writing: 4 },
                            metadata: { legacy_score_0_120_label: "98" }
                        },
                        {
                            id: '2',
                            examType: 'toefl',
                            section: 'full',
                            testDate: '2026-01-15',
                            totalScore: 4,
                            maxScore: 6,
                            scores: { reading: 4, listening: 3, speaking: 4, writing: 3 },
                            metadata: { legacy_score_0_120_label: "92" }
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
    const examResultsLast2y = examResults.filter(r => isWithinLastTwoYears(r.testDate));

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
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
                        <p className="text-muted-foreground mt-2">Track your performance across all exams</p>
                    </div>

                    <div className="bg-card border rounded-lg p-1 flex items-center space-x-1">
                        <button
                            onClick={() => setDisplayMode('six_scale')}
                            className={cn(
                                "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                                displayMode === 'six_scale' ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground"
                            )}
                        >
                            TOEFL (1–6)
                        </button>
                        <button
                            onClick={() => setDisplayMode('legacy_120')}
                            className={cn(
                                "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                                displayMode === 'legacy_120' ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground"
                            )}
                        >
                            Legacy (0–120)
                        </button>
                    </div>
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
                                                {idx === 0 ? 'Latest' : new Date(result.testDate).toLocaleDateString()} - Score: {displayMode === 'six_scale' ? roundToNearestHalf(result.totalScore) : (result.metadata?.legacy_score_0_120_label ?? result.metadata?.legacy_score_0_120_min ?? '')}
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
                                    {selectedExam === 'toefl' && currentResult.metadata?.objective_scaled_030 && (
                                        <span>
                                            Obj (0–30):{" "}
                                            <span className="font-semibold text-foreground">
                                                R {currentResult.metadata.objective_scaled_030.reading ?? "—"} / L {currentResult.metadata.objective_scaled_030.listening ?? "—"}
                                            </span>
                                        </span>
                                    )}
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
                                                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                                    {displayMode === 'legacy_120' ? 'Total Score (0–120)' : 'Total Score (1–6)'}
                                                </span>
                                                <span className="text-4xl font-bold mt-1">
                                                    {displayMode === 'legacy_120'
                                                        ? (currentResult.metadata?.legacy_score_0_120_label ?? currentResult.metadata?.legacy_score_0_120_min ?? "")
                                                        : currentResult.totalScore}
                                                </span>
                                                <span className="text-sm text-muted-foreground">
                                                    out of {displayMode === 'legacy_120' ? 120 : 6}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Section Scores */}
                                        <div className="flex-1 grid grid-cols-2 gap-4 w-full">
                                            {selectedExam === 'toefl' && (
                                                <>
                                                    {renderSectionBox('Reading', currentResult.scores.reading || 0, displayMode === 'legacy_120' ? 30 : 6, displayMode)}
                                                    {renderSectionBox('Listening', currentResult.scores.listening || 0, displayMode === 'legacy_120' ? 30 : 6, displayMode)}
                                                    {renderSectionBox('Speaking', currentResult.scores.speaking || 0, displayMode === 'legacy_120' ? 30 : 6, displayMode)}
                                                    {renderSectionBox('Writing', currentResult.scores.writing || 0, displayMode === 'legacy_120' ? 30 : 6, displayMode)}
                                                </>
                                            )}
                                            {selectedExam === 'gre' && (
                                                <>
                                                    {renderSectionBox('Verbal', currentResult.scores.verbal || 0, 170, displayMode)}
                                                    {renderSectionBox('Quantitative', currentResult.scores.quantitative || 0, 170, displayMode)}
                                                    {renderSectionBox('Writing', currentResult.scores.analytical || 0, 6.0, displayMode)}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Bar */}
                                    <div className="mt-6 flex justify-end border-t pt-6">
                                        <button
                                            onClick={() => setShowReview(true)}
                                            className="flex items-center px-4 py-2 bg-secondary text-secondary-foreground rounded-md font-medium hover:bg-secondary/80 transition-colors"
                                        >
                                            <Award className="w-4 h-4 mr-2" />
                                            Review Questions
                                        </button>
                                    </div>
                                </div>

                                {/* Detailed Review Modal */}
                                {showReview && currentResult && (
                                    <TestResults
                                        totalScore={currentResult.totalScore}
                                        maxScore={currentResult.maxScore}
                                        sectionScores={currentResult.scores as any}
                                        gradedItems={currentResult.metadata?.detailed_review || []}
                                        writingBreakdown={currentResult.metadata?.writing_breakdown}
                                        onClose={() => setShowReview(false)}
                                    />
                                )}

                                {/* SuperScore Card (TOEFL only) */}
                                {selectedExam === 'toefl' && examResultsLast2y.length > 1 && (
                                    <div className="bg-gradient-to-br from-gray-900 to-black text-white border rounded-xl p-8 shadow-lg">
                                        <div className="flex flex-col md:flex-row gap-8">
                                            <div className="md:w-1/3 flex flex-col justify-center">
                                                <div className="text-sm opacity-70 uppercase tracking-wide mb-2">
                                                    MyBest® (Last 2 Years)
                                                </div>
                                                <div className="text-6xl font-bold mb-2">
                                                    {displayMode === 'legacy_120'
                                                        ? calculateSuperScoreLegacy120(examResultsLast2y)
                                                        : calculateSuperScoreSixScale(examResultsLast2y)}
                                                </div>
                                                <div className="text-sm opacity-70">out of {displayMode === 'legacy_120' ? '120' : '6'}</div>
                                            </div>
                                            <div className="md:w-2/3">
                                                <div className="text-sm mb-4 opacity-80">Your highest section scores from the last 2 years ({examResultsLast2y.length} test(s))</div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {renderSuperScoreSection(
                                                        displayMode === 'legacy_120' ? 'Reading (0-30)' : 'Reading (1-6)',
                                                        getBestScore(examResultsLast2y, 'reading'),
                                                        displayMode === 'legacy_120' ? 30 : 6,
                                                        displayMode
                                                    )}
                                                    {renderSuperScoreSection(
                                                        displayMode === 'legacy_120' ? 'Listening (0-30)' : 'Listening (1-6)',
                                                        getBestScore(examResultsLast2y, 'listening'),
                                                        displayMode === 'legacy_120' ? 30 : 6,
                                                        displayMode
                                                    )}
                                                    {renderSuperScoreSection(
                                                        displayMode === 'legacy_120' ? 'Speaking (0-30)' : 'Speaking (1-6)',
                                                        getBestScore(examResultsLast2y, 'speaking'),
                                                        displayMode === 'legacy_120' ? 30 : 6,
                                                        displayMode
                                                    )}
                                                    {renderSuperScoreSection(
                                                        displayMode === 'legacy_120' ? 'Writing (0-30)' : 'Writing (1-6)',
                                                        getBestScore(examResultsLast2y, 'writing'),
                                                        displayMode === 'legacy_120' ? 30 : 6,
                                                        displayMode
                                                    )}
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
        </div >
    );
}

function renderSectionBox(title: string, score: number, max: number, _mode: 'six_scale' | 'legacy_120' = 'six_scale') {
    return (
        <div className="bg-muted/30 rounded-lg p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{title}</div>
            <div className="text-3xl font-bold mb-1">{score}</div>
            <div className="text-xs text-muted-foreground">out of {max}</div>
        </div>
    );
}

function renderSuperScoreSection(title: string, score: number, max: number = 6, _mode: 'six_scale' | 'legacy_120' = 'six_scale') {
    return (
        <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs opacity-70 mb-1">{title}</div>
            <div className="text-2xl font-bold">{score}</div>
            <div className="text-xs opacity-70">out of {max}</div>
        </div>
    );
}

function calculateSuperScoreSixScale(results: ScoreData[]): number {
    if (!results || results.length === 0) return 0;
    const best = {
        reading: Math.max(...results.map(r => r.scores.reading || 1)),
        listening: Math.max(...results.map(r => r.scores.listening || 1)),
        speaking: Math.max(...results.map(r => r.scores.speaking || 1)),
        writing: Math.max(...results.map(r => r.scores.writing || 1))
    };
    const avg = (best.reading + best.listening + best.speaking + best.writing) / 4;
    return roundToNearestHalf(avg);
}

function calculateSuperScoreLegacy120(results: ScoreData[]): number {
    if (!results || results.length === 0) return 0;
    const best = {
        reading: Math.max(...results.map(r => r.scores.reading || 0)),
        listening: Math.max(...results.map(r => r.scores.listening || 0)),
        speaking: Math.max(...results.map(r => r.scores.speaking || 0)),
        writing: Math.max(...results.map(r => r.scores.writing || 0))
    };
    const sum030 = best.reading + best.listening + best.speaking + best.writing;
    if (sum030 > 0) return sum030;
    return Math.max(...results.map(r => (r.metadata?.legacy_score_0_120_min as number) || 0));
}

function getBestScore(results: ScoreData[], section: string): number {
    return Math.max(...results.map(r => (r.scores as any)[section] || 0));
}
