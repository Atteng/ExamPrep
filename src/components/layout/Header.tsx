"use client";
import { useEffect, useState } from "react";
import { MobileNav } from "./MobileNav";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function Header() {
    const [user, setUser] = useState<User | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Check initial user
        supabase.auth.getUser().then(({ data }) => setUser(data.user));

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.refresh();
        router.push('/');
    };

    return (
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-between px-4">
                <div className="flex items-center">
                    <MobileNav />
                    <div className="mr-4 hidden md:flex">
                        <Link className="mr-6 flex items-center space-x-2 font-bold" href="/">
                            ExamPrep
                        </Link>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {user ? (
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground hidden sm:inline-block">
                                {user.email}
                            </span>
                            <button
                                onClick={handleSignOut}
                                className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="hidden sm:inline">Sign Out</span>
                            </button>
                        </div>
                    ) : (
                        <Link
                            href="/login"
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
                        >
                            <UserIcon className="w-4 h-4 mr-2" />
                            Sign In
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
