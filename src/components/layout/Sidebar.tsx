"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, GraduationCap, BarChart3, Settings, School, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase"; // Ensure this client exists or use createClientComponentClient
import { getUserProfile } from "@/lib/db/actions";

export function Sidebar({ className }: { className?: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isGuest, setIsGuest] = useState(true);
    const [isPro, setIsPro] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setIsGuest(false);
                const profile = await getUserProfile(user.id);
                setIsPro(!!profile?.is_pro);
            } else {
                setIsGuest(true);
            }
            setLoading(false);
        };
        checkStatus();
    }, []);

    const handleUpgrade = async () => {
        setIsLoadingCheckout(true);
        try {
            // Check if user is logged in first
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                // Redirect to login if not authenticated
                router.push('/login');
                return;
            }

            // Redirect to Paystack Init API
            const res = await fetch('/api/paystack/initialize', {
                method: 'POST',
            });

            console.log('API Response status:', res.status);
            const data = await res.json();
            console.log('API Response data:', data);

            if (data.url) {
                window.location.href = data.url;
            } else {
                console.error("Paystack Init Failed - Full response:", {
                    status: res.status,
                    data: data,
                    error: data.error || 'No error message provided'
                });
                alert(`Payment initialization failed: ${data.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error("Checkout Failed", err);
        } finally {
            setIsLoadingCheckout(false);
        }
    };

    const links = [
        { href: "/", label: "Dashboard", icon: LayoutDashboard, public: true },
        { href: "/practice", label: "Practice Mode", icon: GraduationCap, public: true },
        { href: "/schools", label: "School Tracker", icon: School, public: false },
        { href: "/analytics", label: "Analytics", icon: BarChart3, public: false },
        { href: "/profile", label: "Settings", icon: Settings, public: false },
    ];

    const handleProtectedClick = (e: React.MouseEvent, label: string) => {
        if (isGuest) {
            e.preventDefault();
            if (confirm(`Please log in to access your ${label}.\n\nWould you like to log in now?`)) {
                router.push("/login");
            }
        }
    };

    return (
        <div className={cn("pb-12 min-h-screen border-r bg-background", className)}>
            <div className="space-y-4 py-4">
                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                        ExamPrep
                    </h2>
                    <div className="space-y-1">
                        {links.map((link) => {
                            const Icon = link.icon;
                            const isActive = pathname === link.href;
                            const isLocked = isGuest && !link.public;

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={(e) => isLocked && handleProtectedClick(e, link.label)}
                                    className={cn(
                                        "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                        isActive
                                            ? "bg-accent text-accent-foreground"
                                            : "hover:bg-accent hover:text-accent-foreground",
                                        isLocked && "text-muted-foreground hover:bg-transparent cursor-pointer opacity-70"
                                    )}
                                >
                                    <Icon className="mr-2 h-4 w-4" />
                                    <span>{link.label}</span>
                                    {isLocked && (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            strokeWidth={1.5}
                                            stroke="currentColor"
                                            className="ml-auto w-3 h-3 opacity-50"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                        </svg>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Upgrade Card */}
            {!loading && !isPro && (
                <div className="mt-auto px-3">
                    <div className="rounded-lg border bg-card p-4 shadow-sm">
                        <h3 className="font-semibold mb-1">Upgrade to Pro</h3>
                        <p className="text-xs text-muted-foreground mb-3">
                            Format-accurate Tests, AI Feedback & Unlimited Practice.
                        </p>
                        <button
                            onClick={handleUpgrade}
                            disabled={isLoadingCheckout}
                            className="w-full flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2 text-sm font-medium transition-colors shadow-sm"
                        >
                            {isLoadingCheckout ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Go Pro for $10
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
