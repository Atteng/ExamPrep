"use client";

import { useState, useEffect } from "react";
import { User, Calendar, Target, Sun, Moon, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { getUserProfile, updateUserProfile } from "@/lib/db/actions";

export default function ProfilePage() {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        weeklyGoal: 15,
        toeflDate: '',
        toeflTarget: 100,
        greDate: '',
        greVerbalTarget: 160,
        greQuantTarget: 165,
        germanDate: '',
        germanLevel: 'B2'
    });

    useEffect(() => {
        async function loadProfile() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                const profile = await getUserProfile(user.id);
                if (profile) {
                    const meta = profile.metadata || {};
                    setFormData(prev => ({
                        ...prev,
                        name: profile.full_name || '',
                        weeklyGoal: profile.study_goal_hours || 15,
                        // Load exam data from metadata
                        toeflDate: meta.toeflDate || '',
                        toeflTarget: meta.toeflTarget || 100,
                        greDate: meta.greDate || '',
                        greVerbalTarget: meta.greVerbalTarget || 160,
                        greQuantTarget: meta.greQuantTarget || 165,
                        germanDate: meta.germanDate || '',
                        germanLevel: meta.germanLevel || 'B2'
                    }));
                }
            }
        }
        loadProfile();
    }, []);

    const handleSave = async () => {
        if (!userId) {
            alert("You must be logged in to save settings.");
            return;
        }
        setLoading(true);
        try {
            // Determine target exam based on which date is set or defaulting
            // For now, let's just save the metadata.
            // Ideally we logic-check which is "primary", but we'll stick to a simple heuristic or manual field later.

            await updateUserProfile({
                id: userId,
                full_name: formData.name,
                study_goal_hours: formData.weeklyGoal,
                target_exam: 'toefl', // Keep default or add selector.
                metadata: {
                    toeflDate: formData.toeflDate,
                    toeflTarget: formData.toeflTarget,
                    greDate: formData.greDate,
                    greVerbalTarget: formData.greVerbalTarget,
                    greQuantTarget: formData.greQuantTarget,
                    germanDate: formData.germanDate,
                    germanLevel: formData.germanLevel
                }
            });
            alert('Settings saved!');
        } catch (error) {
            console.error(error);
            alert('Failed to save settings. Ensure your profiles table has a "metadata" jsonb column.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="container max-w-4xl mx-auto p-6 space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Profile & Settings</h1>
                    <p className="text-muted-foreground mt-2">Manage your goals, exam dates, and preferences</p>
                </div>

                {/* Personal Details */}
                <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 pb-4 border-b">
                        <User className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-semibold">Personal Details</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Display Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Enter your name"
                                className="w-full mt-2 px-4 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Weekly Study Goal (Hours)</label>
                            <input
                                type="number"
                                value={formData.weeklyGoal}
                                onChange={(e) => setFormData({ ...formData, weeklyGoal: parseInt(e.target.value) })}
                                min="1"
                                max="168"
                                className="w-full mt-2 px-4 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Exam Schedule - TOEFL */}
                <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 pb-4 border-b">
                        <Calendar className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-semibold">TOEFL Exam Schedule</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Exam Date</label>
                            <input
                                type="date"
                                value={formData.toeflDate}
                                onChange={(e) => setFormData({ ...formData, toeflDate: e.target.value })}
                                className="w-full mt-2 px-4 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Target Score (Total)</label>
                            <input
                                type="number"
                                value={formData.toeflTarget}
                                onChange={(e) => setFormData({ ...formData, toeflTarget: parseInt(e.target.value) })}
                                min="0"
                                max="120"
                                className="w-full mt-2 px-4 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Exam Schedule - GRE */}
                <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 pb-4 border-b">
                        <Target className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-semibold">GRE Exam Schedule</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Exam Date</label>
                            <input
                                type="date"
                                value={formData.greDate}
                                onChange={(e) => setFormData({ ...formData, greDate: e.target.value })}
                                className="w-full mt-2 px-4 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Target Verbal Score</label>
                            <input
                                type="number"
                                value={formData.greVerbalTarget}
                                onChange={(e) => setFormData({ ...formData, greVerbalTarget: parseInt(e.target.value) })}
                                min="130"
                                max="170"
                                className="w-full mt-2 px-4 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">Target Quantitative Score</label>
                            <input
                                type="number"
                                value={formData.greQuantTarget}
                                onChange={(e) => setFormData({ ...formData, greQuantTarget: parseInt(e.target.value) })}
                                min="130"
                                max="170"
                                className="w-full mt-2 px-4 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Exam Schedule - German */}
                <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 pb-4 border-b">
                        <Calendar className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-semibold">German Exam Schedule</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Exam Date</label>
                            <input
                                type="date"
                                value={formData.germanDate}
                                onChange={(e) => setFormData({ ...formData, germanDate: e.target.value })}
                                className="w-full mt-2 px-4 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Target Level</label>
                            <select
                                value={formData.germanLevel}
                                onChange={(e) => setFormData({ ...formData, germanLevel: e.target.value })}
                                className="w-full mt-2 px-4 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="A1">A1</option>
                                <option value="A2">A2</option>
                                <option value="B1">B1</option>
                                <option value="B2">B2</option>
                                <option value="C1">C1</option>
                                <option value="C2">C2</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* App Preferences */}
                <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 pb-4 border-b">
                        <Sun className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-semibold">App Preferences</h2>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Visual Theme</label>
                        <div className="grid grid-cols-2 gap-4 mt-3">
                            <button
                                onClick={() => setTheme('light')}
                                className={cn(
                                    "flex items-center justify-center gap-3 p-4 border rounded-lg transition-all",
                                    theme === 'light' ? "border-primary bg-primary/5 ring-2 ring-primary" : "hover:bg-muted"
                                )}
                            >
                                <Sun className="w-5 h-5" />
                                <span className="font-medium">Light</span>
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={cn(
                                    "flex items-center justify-center gap-3 p-4 border rounded-lg transition-all",
                                    theme === 'dark' ? "border-primary bg-primary/5 ring-2 ring-primary" : "hover:bg-muted"
                                )}
                            >
                                <Moon className="w-5 h-5" />
                                <span className="font-medium">Dark</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 px-6 rounded-md font-semibold hover:bg-primary/90 transition-colors shadow-md"
                >
                    <Save className="w-5 h-5" />
                    Save Settings
                </button>
            </div>
        </div>
    );
}
