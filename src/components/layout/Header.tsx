import { MobileNav } from "./MobileNav";

export function Header() {
    return (
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center">
                <MobileNav />
                <div className="mr-4 hidden md:flex">
                    <a className="mr-6 flex items-center space-x-2 font-bold" href="/">
                        ExamPrep
                    </a>
                </div>
            </div>
        </header>
    );
}
