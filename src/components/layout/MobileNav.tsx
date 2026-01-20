"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

export function MobileNav() {
    const [open, setOpen] = useState(false);

    return (
        <div className="md:hidden">
            <button onClick={() => setOpen(true)} className="p-2">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/80"
                        onClick={() => setOpen(false)}
                    />

                    {/* Drawer */}
                    <div className="relative z-50 w-[80%] max-w-[300px] bg-background">
                        <div className="flex items-center justify-end p-4">
                            <button onClick={() => setOpen(false)}>
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <Sidebar className="border-none" />
                    </div>
                </div>
            )}
        </div>
    );
}
