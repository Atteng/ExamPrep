import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col md:flex-row">
            {/* Desktop Sidebar (hidden on mobile) */}
            <aside className="hidden w-64 md:block border-r bg-background">
                <Sidebar className="border-none" />
            </aside>

            <div className="flex-1 flex flex-col">
                <Header />
                <main className="flex-1 p-4 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
