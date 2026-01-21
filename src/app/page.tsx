"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  Target,
  Trophy,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { getUserProfile, getUserResults, getUserStats } from "@/lib/db/actions";

import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

// Separate component for Payment Feedback to handle useSearchParams with Suspense
function PaymentFeedback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentStatus = searchParams.get('payment');

  useEffect(() => {
    if (paymentStatus === 'success') {
      // Clean URL after 3 seconds
      const timer = setTimeout(() => {
        router.replace('/');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus, router]);

  if (paymentStatus === 'success') {
    return (
      <div className="rounded-lg border bg-green-50 border-green-200 p-4 shadow-sm flex items-center animate-in fade-in slide-in-from-top-2">
        <CheckCircle2 className="h-6 w-6 text-green-600 mr-3" />
        <div>
          <h3 className="font-semibold text-green-800">Payment Successful!</h3>
          <p className="text-sm text-green-700">Welcome to ExamPrep Pro. You now have unlimited access.</p>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <div className="rounded-lg border bg-red-50 border-red-200 p-4 shadow-sm flex items-center animate-in fade-in slide-in-from-top-2">
        <XCircle className="h-6 w-6 text-red-600 mr-3" />
        <div>
          <h3 className="font-semibold text-red-800">Payment Failed</h3>
          <p className="text-sm text-red-700">Something went wrong. Please try again or contact support.</p>
        </div>
      </div>
    );
  }

  return null;
}

export default function Home() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Removed useSearchParams from here

  const [stats, setStats] = useState({ questionsAnswered: 0, avgAccuracy: 0, studyHours: 0, testsTaken: 0 });

  useEffect(() => {
    async function loadDashboard() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const [userProfile, userStats] = await Promise.all([
            getUserProfile(user.id),
            getUserStats(user.id)
          ]);
          setProfile(userProfile);
          if (userStats) setStats(userStats);
        } else {
          // Guest State
          setProfile({ full_name: "Guest Student" });
        }
      } catch (error) {
        console.error("Dashboard load failed", error);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  // Fallback/Default values if no profile set
  const displayName = profile?.full_name || "Guest Student";
  const studyGoal = profile?.study_goal_hours || 15;
  const meta = profile?.metadata || {};

  // Helper to calculate days remaining
  const getDaysRemaining = (dateString?: string) => {
    if (!dateString) return null;
    const examDate = new Date(dateString);
    const today = new Date();
    const diffTime = examDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays; // Can be negative if passed
  };

  // Helper to format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not Scheduled";
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const toeflDays = getDaysRemaining(meta.toeflDate);
  const greDays = getDaysRemaining(meta.greDate);
  const germanDays = getDaysRemaining(meta.germanDate);

  // Determine Priority: Only count positive future dates
  // If multiple, pick the smallest positive
  const upcoming = [
    { id: 'toefl', days: toeflDays },
    { id: 'gre', days: greDays },
    { id: 'german', days: germanDays }
  ].filter(e => e.days !== null && e.days >= 0).sort((a, b) => (a.days!) - (b.days!));

  const priorityExamId = upcoming.length > 0 ? upcoming[0].id : null;
  const nextExamDays = upcoming.length > 0 ? upcoming[0].days : "N/A";
  const nextExamLabel = upcoming.length > 0 ? upcoming[0].id.toUpperCase() : "None";

  const exams = [
    {
      id: "toefl",
      title: "TOEFL iBT",
      badge: priorityExamId === 'toefl' ? "Next Exam" : meta.toeflDate ? "Scheduled" : "Available",
      target: meta.toeflTarget ? `${meta.toeflTarget}+` : "100+",
      date: formatDate(meta.toeflDate),
      color: "bg-blue-600",
      image: "/toefl logo.svg",
      countdown: toeflDays,
      stats: { taken: 0, avg: "N/A" }
    },
    {
      id: "gre",
      title: "GRE General",
      badge: priorityExamId === 'gre' ? "Next Exam" : meta.greDate ? "Scheduled" : "Available",
      target: meta.greVerbalTarget ? `V${meta.greVerbalTarget} Q${meta.greQuantTarget}` : "Q155+ W4.0",
      date: formatDate(meta.greDate),
      color: "bg-purple-600",
      image: "/GRE_logo_2024.svg",
      countdown: greDays,
      stats: { taken: 0, avg: "N/A" }
    },
    {
      id: "german",
      title: "German",
      badge: priorityExamId === 'german' ? "Next Exam" : meta.germanDate ? "Scheduled" : "Available",
      target: meta.germanLevel || "C1",
      date: formatDate(meta.germanDate),
      color: "bg-yellow-600",
      image: "/german flag.png",
      countdown: germanDays,
      stats: { taken: 0, avg: "N/A" }
    }
  ];

  return (
    <div className="space-y-8">
      {/* Payment Success/Error Banner */}
      <Suspense fallback={null}>
        <PaymentFeedback />
      </Suspense>

      {/* Welcome Section */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {displayName}</h1>
        <p className="text-muted-foreground">
          You&apos;re making great progress towards your goals.
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Weekly Study", value: `${stats.studyHours}/${studyGoal}h`, icon: Clock, trend: "Keep it up" },
          { label: "Questions", value: `${stats.questionsAnswered}`, icon: BookOpen, trend: "Total answered" },
          { label: "Avg Accuracy", value: `${stats.avgAccuracy}%`, icon: Target, trend: "Overall performance" },
          {
            label: "Next Exam",
            value: nextExamDays === "N/A" ? "N/A" : `${nextExamDays}d`,
            icon: Trophy,
            trend: nextExamLabel
          },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border bg-card text-card-foreground shadow p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <span className="text-sm font-medium">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
          </div>
        ))}
      </div>

      {/* Exam Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {exams.map((exam) => (
          <div key={exam.id} className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={exam.image} alt={exam.title} className="h-full w-full object-contain" />
                </div>
                <span className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
                  exam.id === priorityExamId
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-transparent"
                )}>
                  {exam.badge}
                </span>
              </div>

              <h3 className="text-xl font-bold mb-1">{exam.title}</h3>
              {exam.countdown !== null && exam.countdown >= 0 && (
                <p className="text-sm text-green-600 font-medium mb-3">
                  {exam.countdown === 0 ? "Today!" : `${exam.countdown} days left`}
                </p>
              )}
              {(exam.countdown === null || exam.countdown < 0) && (
                <p className="text-sm text-muted-foreground mb-3">
                  {exam.date === "Not Scheduled" ? "Not Scheduled" : "Exam Passed"}
                </p>
              )}

              <div className="space-y-2 text-sm mt-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target</span>
                  <span className="font-medium">{exam.target}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{exam.date}</span>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 p-4">
              <Link
                href="/practice"
                className="flex items-center justify-center w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Practice Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
