"use client";

import { useState, useEffect } from "react";
import { School, NewSchool, SchoolStatus, SchoolRequirement } from "@/lib/db/schools";
import { X, Plus, Trash2, MapPin, Banknote, GraduationCap, Lightbulb, ListTodo, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditSchoolModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (school: NewSchool) => Promise<void>;
    school?: School; // If provided, we are editing
}

const STATUS_OPTIONS: SchoolStatus[] = ['active', 'submitted', 'accepted', 'rejected'];

export function EditSchoolModal({ isOpen, onClose, onSave, school }: EditSchoolModalProps) {
    const [name, setName] = useState(school?.name || "");
    const [program, setProgram] = useState(school?.program || "");
    const [status, setStatus] = useState<SchoolStatus>(school?.status || 'active');
    const [deadline, setDeadline] = useState(
        school?.deadline ? new Date(school.deadline).toISOString().split('T')[0] : ""
    );
    const [requirements, setRequirements] = useState<SchoolRequirement[]>(
        school?.requirements || [
            { item: "CV/Resume", done: false },
            { item: "Transcript", done: false },
            { item: "Motivation Letter", done: false }
        ]
    );

    // New Fields
    const [location, setLocation] = useState(school?.location || "");
    const [feeAmount, setFeeAmount] = useState(school?.fee_amount || "");
    const [feeNote, setFeeNote] = useState(school?.fee_note || "");
    const [testToefl, setTestToefl] = useState(school?.test_toefl || "");
    const [testIelts, setTestIelts] = useState(school?.test_ielts || "");
    const [testGre, setTestGre] = useState(school?.test_gre || "");
    const [insights, setInsights] = useState<string[]>(school?.insights || []);

    const [isSaving, setIsSaving] = useState(false);

    // Sync state with props when modal opens or school changes
    useEffect(() => {
        if (isOpen) {
            setName(school?.name || "");
            setProgram(school?.program || "");
            setStatus(school?.status || 'active');
            setDeadline(school?.deadline ? new Date(school.deadline).toISOString().split('T')[0] : "");
            setRequirements(school?.requirements || [
                { item: "CV/Resume", done: false },
                { item: "Transcript", done: false },
                { item: "Motivation Letter", done: false }
            ]);
            setLocation(school?.location || "");
            setFeeAmount(school?.fee_amount || "");
            setFeeNote(school?.fee_note || "");
            setTestToefl(school?.test_toefl || "");
            setTestIelts(school?.test_ielts || "");
            setTestGre(school?.test_gre || "");
            setInsights(school?.insights || []);
        }
    }, [isOpen, school]);

    if (!isOpen) return null;

    // Requirements Helpers
    const handleAddRequirement = () => {
        setRequirements([...requirements, { item: "", done: false }]);
    };
    const handleReqChange = (index: number, val: string) => {
        const newReqs = [...requirements];
        newReqs[index].item = val;
        setRequirements(newReqs);
    };
    const handleRemoveReq = (index: number) => {
        setRequirements(requirements.filter((_, i) => i !== index));
    };

    // Insights Helpers
    const handleAddInsight = () => {
        setInsights([...insights, ""]);
    };
    const handleInsightChange = (index: number, val: string) => {
        const newInsights = [...insights];
        newInsights[index] = val;
        setInsights(newInsights);
    };
    const handleRemoveInsight = (index: number) => {
        setInsights(insights.filter((_, i) => i !== index));
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave({
                name,
                program,
                status,
                deadline: deadline ? new Date(deadline).toISOString() : undefined,
                requirements: requirements.filter(r => r.item.trim() !== ""),
                location,
                fee_amount: feeAmount,
                fee_note: feeNote,
                test_toefl: testToefl,
                test_ielts: testIelts,
                test_gre: testGre,
                insights: insights.filter(i => i.trim() !== "")
            });
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-background w-full max-w-2xl rounded-xl shadow-lg border p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">{school ? "Edit Application" : "New Application"}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4 border-b pb-6">
                        <h3 className="text-sm font-semibold uppercase text-muted-foreground flex items-center">
                            <GraduationCap className="w-4 h-4 mr-2" /> Basic Information
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">University Name *</label>
                                <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border rounded-md bg-background" placeholder="e.g. TU Munich" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Program</label>
                                <input value={program} onChange={(e) => setProgram(e.target.value)} className="w-full px-3 py-2 border rounded-md bg-background" placeholder="e.g. M.Sc. Data Science" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Location</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                    <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-md bg-background" placeholder="e.g. Munich, Germany" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Status</label>
                                <select value={status} onChange={(e) => setStatus(e.target.value as SchoolStatus)} className="w-full px-3 py-2 border rounded-md bg-background capitalize">
                                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Fees & Deadlines */}
                    <div className="space-y-4 border-b pb-6">
                        <h3 className="text-sm font-semibold uppercase text-muted-foreground flex items-center">
                            <Banknote className="w-4 h-4 mr-2" /> Application Details
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Deadline</label>
                                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full px-3 py-2 border rounded-md bg-background" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">App Fee</label>
                                <input value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} className="w-full px-3 py-2 border rounded-md bg-background" placeholder="e.g. €50" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Fee Note</label>
                                <input value={feeNote} onChange={(e) => setFeeNote(e.target.value)} className="w-full px-3 py-2 border rounded-md bg-background" placeholder="e.g. via Uni-Assist" />
                            </div>
                        </div>
                    </div>

                    {/* Test Scores */}
                    <div className="space-y-4 border-b pb-6">
                        <h3 className="text-sm font-semibold uppercase text-muted-foreground flex items-center">
                            <FileText className="w-4 h-4 mr-2" /> Required Scores
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">TOEFL</label>
                                <input value={testToefl} onChange={(e) => setTestToefl(e.target.value)} className="w-full px-3 py-2 border rounded-md bg-background" placeholder="e.g. 100+" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">IELTS</label>
                                <input value={testIelts} onChange={(e) => setTestIelts(e.target.value)} className="w-full px-3 py-2 border rounded-md bg-background" placeholder="e.g. 7.5+" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">GRE</label>
                                <input value={testGre} onChange={(e) => setTestGre(e.target.value)} className="w-full px-3 py-2 border rounded-md bg-background" placeholder="e.g. 320+" />
                            </div>
                        </div>
                    </div>

                    {/* Requirements */}
                    <div className="space-y-3 pt-2">
                        <label className="text-sm font-semibold flex justify-between items-center text-muted-foreground uppercase">
                            <span className="flex items-center"><ListTodo className="w-4 h-4 mr-2" /> Checklist</span>
                            <button type="button" onClick={handleAddRequirement} className="text-xs text-primary hover:underline flex items-center normal-case">
                                <Plus className="w-3 h-3 mr-1" /> Add Item
                            </button>
                        </label>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                            {requirements.map((req, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <input value={req.item} onChange={(e) => handleReqChange(idx, e.target.value)} className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-background" placeholder="Requirement (e.g. CV)" />
                                    <button type="button" onClick={() => handleRemoveReq(idx)} className="text-muted-foreground hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Insights */}
                    <div className="space-y-3 pt-4">
                        <label className="text-sm font-semibold flex justify-between items-center text-muted-foreground uppercase">
                            <span className="flex items-center"><Lightbulb className="w-4 h-4 mr-2" /> Insights & Notes</span>
                            <button type="button" onClick={handleAddInsight} className="text-xs text-primary hover:underline flex items-center normal-case">
                                <Plus className="w-3 h-3 mr-1" /> Add Insight
                            </button>
                        </label>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                            {insights.map((insight, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <input value={insight} onChange={(e) => handleInsightChange(idx, e.target.value)} className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-background" placeholder="Note (e.g. High cost of living)" />
                                    <button type="button" onClick={() => handleRemoveInsight(idx)} className="text-muted-foreground hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-6 flex justify-end gap-2 border-t mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md">Cancel</button>
                        <button type="submit" disabled={isSaving} className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md disabled:opacity-50">
                            {isSaving ? "Saving..." : "Save Application"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
