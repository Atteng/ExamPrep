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
    const [isPro, setIsPro] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const profile = await getUserProfile(user.id);
                setIsPro(!!profile?.is_pro);
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
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
        { href: "/practice", label: "Practice Mode", icon: GraduationCap },
        { href: "/schools", label: "School Tracker", icon: School },
        { href: "/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/profile", label: "Settings", icon: Settings },
    ];

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
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={cn(
                                        "flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                                        isActive ? "bg-accent text-accent-foreground" : "transparent"
                                    )}
                                >
                                    <Icon className="mr-2 h-4 w-4" />
                                    {link.label}
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
