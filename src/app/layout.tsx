import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import AuthGuard from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "ExamPrep",
  description: "AI-Powered Exam Preparation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-background text-foreground">
        <AuthGuard>{children}</AuthGuard>
        <Analytics />
      </body>
    </html>
  );
}
