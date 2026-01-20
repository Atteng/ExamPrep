"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { updateUserProfile } from "@/lib/db/actions"; // Import helper
import { Loader2, Mail, Lock, ArrowRight, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
    const router = useRouter();
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // ...

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        console.log("Attempting Auth...", { isSignUp, email });

        try {
            if (isSignUp) {
                console.log("Attempting Sign Up...");
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                console.log("Sign Up Response:", { data, error });
                if (error) throw error;

                // Auto-create profile entry
                if (data.user) {
                    console.log("Creating user profile...");
                    await updateUserProfile({
                        id: data.user.id,
                        email: email,
                        full_name: email.split('@')[0], // Default name from email
                        study_goal_hours: 10
                    });
                }

                setSuccessMessage("Account created! Please check your email and click the verification link to complete your registration.");
                setIsSignUp(false);
            } else {
                console.log("Attempting Sign In...");
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                console.log("Sign In Response:", { data, error });
                if (error) throw error;

                console.log("Sign in successful, redirecting...");
                // Use replace instead of push to avoid back button issues
                router.replace("/");
            }
        } catch (err: any) {
            console.error("Auth Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Left: Branding (Hidden on Mobile) */}
            <div className="hidden lg:flex lg:w-1/2 bg-zinc-900 flex-col justify-between p-12 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20" />

                {/* Logo Area */}
                <div className="relative z-10 flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/10">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">ExamPrep AI</span>
                </div>

                {/* Hero Text */}
                <div className="relative z-10 space-y-6 max-w-lg">
                    <h1 className="text-5xl font-bold leading-tight">
                        Master your exams with AI-driven practice.
                    </h1>
                    <p className="text-lg text-zinc-400">
                        Join thousands of students forcing specific vocabulary usage, practicing authentic speaking scenarios, and tracking detailed analytics.
                    </p>
                </div>

                {/* Footer Quote */}
                <div className="relative z-10 text-sm text-zinc-500">
                    © 2026 ExamPrep AI. Built for high achievers.
                </div>
            </div>

            {/* Right: Auth Form */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background">
                <div className="w-full max-w-md space-y-8">
                    {/* Mobile Logo (Visible only on mobile) */}
                    <div className="flex lg:hidden items-center gap-2 mb-8 just-center">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                            <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-lg font-bold">ExamPrep AI</span>
                    </div>

                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold tracking-tight">
                            {isSignUp ? "Create an account" : "Welcome back"}
                        </h2>
                        <p className="text-muted-foreground">
                            {isSignUp ? "Enter your email below to create your account" : "Enter your email below to login to your account"}
                        </p>
                    </div>



                    {successMessage && (
                        <div className="p-4 bg-green-50/50 border border-green-200 text-green-700 rounded-lg text-sm text-center">
                            <p className="font-semibold mb-1">Success!</p>
                            {successMessage}
                        </div>
                    )}

                    <form onSubmit={handleAuth} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 text-sm text-red-500 bg-red-50/50 border border-red-200 rounded-md">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center justify-center w-full h-10 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    {isSignUp ? "Sign Up" : "Sign In"}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="text-center text-sm">
                        <span className="text-muted-foreground">
                            {isSignUp ? "Already have an account? " : "Don't have an account? "}
                        </span>
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="font-semibold text-primary hover:underline underline-offset-4"
                        >
                            {isSignUp ? "Sign In" : "Sign Up"}
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
