"use client";

import { School, updateSchool } from "@/lib/db/schools";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, MoreVertical, GraduationCap, Clock, MapPin, Banknote, ListChecks, Lightbulb } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow, parseISO, isPast } from "date-fns";

interface SchoolCardProps {
    school: School;
    onUpdate: (updatedSchool: School) => void;
    onDelete: (id: string) => void;
    onEdit: (school: School) => void;
}

export function SchoolCard({ school, onUpdate, onDelete, onEdit }: SchoolCardProps) {
    const [isUpdating, setIsUpdating] = useState(false);

    const toggleRequirement = async (index: number) => {
        setIsUpdating(true);
        const newReqs = [...school.requirements];
        newReqs[index].done = !newReqs[index].done;

        try {
            const updated = await updateSchool(school.id, { requirements: newReqs });
            onUpdate(updated);
        } catch (error) {
            console.error("Failed to toggle requirement:", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'accepted': return "bg-green-100 text-green-700 border-green-200";
            case 'rejected': return "bg-red-100 text-red-700 border-red-200";
            case 'submitted': return "bg-blue-100 text-blue-700 border-blue-200";
            default: return "bg-secondary text-secondary-foreground";
        }
    };

    const getDeadlineColor = (dateStr: string | null) => {
        if (!dateStr) return "text-muted-foreground";
        const date = parseISO(dateStr);
        if (isPast(date)) return "text-red-500 font-medium";
        const daysLeft = Math.floor((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 7) return "text-orange-500 font-medium";
        return "text-muted-foreground";
    };

    return (
        <div className="group relative flex flex-col bg-card border rounded-xl shadow-sm hover:shadow-md transition-all p-4 space-y-4">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-lg leading-none">{school.name}</h3>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border capitalize", getStatusColor(school.status))}>
                            {school.status}
                        </span>
                    </div>
                    {school.program && (
                        <p className="text-sm text-muted-foreground flex items-center mt-1">
                            <GraduationCap className="w-3 h-3 mr-1" />
                            {school.program}
                        </p>
                    )}
                    {school.location && (
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {school.location}
                        </p>
                    )}
                </div>
                <div className="relative">
                    <button
                        onClick={() => onEdit(school)}
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Rich Info Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Deadline */}
                {school.deadline && (
                    <div className={cn("flex items-center p-2 rounded bg-muted/30", getDeadlineColor(school.deadline))}>
                        <Clock className="w-3.5 h-3.5 mr-2" />
                        <div>
                            <div className="font-medium">Deadline</div>
                            <div>{isPast(parseISO(school.deadline))
                                ? `Passed`
                                : formatDistanceToNow(parseISO(school.deadline))}</div>
                        </div>
                    </div>
                )}

                {/* Fees */}
                {school.fee_amount && (
                    <div className="flex items-center p-2 rounded bg-muted/30 text-muted-foreground">
                        <Banknote className="w-3.5 h-3.5 mr-2" />
                        <div>
                            <div className="font-medium">Fees: {school.fee_amount}</div>
                            {school.fee_note && <div className="text-[10px] opacity-75">{school.fee_note}</div>}
                        </div>
                    </div>
                )}
            </div>

            {/* Test Scores Badges */}
            {(school.test_toefl || school.test_ielts || school.test_gre) && (
                <div className="flex flex-wrap gap-2 text-xs">
                    {school.test_toefl && (
                        <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">
                            TOEFL: {school.test_toefl}
                        </span>
                    )}
                    {school.test_ielts && (
                        <span className="px-2 py-1 rounded bg-teal-50 text-teal-700 border border-teal-100 font-medium">
                            IELTS: {school.test_ielts}
                        </span>
                    )}
                    {school.test_gre && (
                        <span className="px-2 py-1 rounded bg-purple-50 text-purple-700 border border-purple-100 font-medium">
                            GRE: {school.test_gre}
                        </span>
                    )}
                </div>
            )}

            {/* Requirements Progress */}
            <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium flex items-center">
                        <ListChecks className="w-3 h-3 mr-1" /> Requirements
                    </span>
                    <span>{school.requirements.filter(r => r.done).length}/{school.requirements.length}</span>
                </div>

                {/* Checklist (First 3 items only in card view) */}
                <div className="space-y-1.5">
                    {school.requirements.slice(0, 3).map((req, idx) => (
                        <button
                            key={idx}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleRequirement(idx);
                            }}
                            disabled={isUpdating}
                            className="w-full flex items-center text-xs text-left group/item hover:bg-muted/50 p-1 rounded transition-colors"
                        >
                            {req.done ? (
                                <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-green-500 flex-shrink-0" />
                            ) : (
                                <Circle className="w-3.5 h-3.5 mr-2 text-muted-foreground group-hover/item:text-primary flex-shrink-0" />
                            )}
                            <span className={cn(
                                "truncate transition-all",
                                req.done && "text-muted-foreground line-through decoration-muted-foreground/50"
                            )}>
                                {req.item}
                            </span>
                        </button>
                    ))}
                    {school.requirements.length > 3 && (
                        <p className="text-[10px] text-center text-muted-foreground pt-1">
                            + {school.requirements.length - 3} more items
                        </p>
                    )}
                </div>
            </div>

            {/* Insights (Collapsed view) */}
            {school.insights && school.insights.length > 0 && (
                <div className="pt-2 border-t text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 font-medium mb-1.5 text-amber-600/80">
                        <Lightbulb className="w-3 h-3" /> Insights
                    </div>
                    <ul className="pl-4 list-disc space-y-0.5">
                        {school.insights.slice(0, 2).map((insight, i) => (
                            <li key={i} className="line-clamp-1">{insight}</li>
                        ))}
                    </ul>
                </div>
            )}

        </div>
    );
}
