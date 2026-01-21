"use client";

import { usePathname } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Routes that should NOT have the dashboard layout (sidebar + header)
    const publicOnlyRoutes = ['/login'];

    if (publicOnlyRoutes.includes(pathname)) {
        return <>{children}</>;
    }

    // All other routes get the dashboard layout (guest or logged in)
    return <DashboardLayout>{children}</DashboardLayout>;
}
