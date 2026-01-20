"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Loader2 } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    setIsAuthenticated(true);
                    // If stuck on login page but authenticated, go to dashboard
                    if (pathname === '/login') {
                        router.replace('/');
                    }
                } else {
                    setIsAuthenticated(false);
                    // If not on login page and not authenticated, go to login
                    if (pathname !== '/login') {
                        router.replace('/login');
                    }
                }
            } catch (error) {
                console.error("Auth check failed", error);
            } finally {
                // Determine if we should stop loading
                // If redirecting, we might want to keep loading?
                // But generally, we set loading false to show content (or login page)
                setIsLoading(false);
            }
        };

        checkAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                setIsAuthenticated(false);
                router.replace('/login');
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                setIsAuthenticated(true);
                if (pathname === '/login') {
                    router.replace('/');
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [pathname, router]);

    // Show Loader while checking initial session
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // If on login page, render without dashboard layout
    if (pathname === '/login') {
        // Prevent flash of login form if we are authenticated and waiting for redirect
        if (isAuthenticated) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-background">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            );
        }
        return <>{children}</>;
    }

    // If authenticated (and not on login), render with Dashboard Layout
    // Note: If !isAuthenticated and not login, we already triggered redirect in useEffect
    // returning null here avoids flash of protected content
    if (!isAuthenticated) {
        return null;
    }

    return (
        <DashboardLayout>
            {children}
        </DashboardLayout>
    );
}
