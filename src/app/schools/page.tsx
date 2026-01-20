"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { getSchools, addSchool, updateSchool, deleteSchool, School, NewSchool, SchoolStatus } from "@/lib/db/schools";
import { SchoolCard } from "@/components/schools/SchoolCard";
import { EditSchoolModal } from "@/components/schools/EditSchoolModal";
import { Plus, Search, Filter, GraduationCap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function SchoolsPage() {
    const router = useRouter();
    const [schools, setSchools] = useState<School[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<SchoolStatus | 'all'>('all');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSchool, setEditingSchool] = useState<School | undefined>(undefined);

    useEffect(() => {
        checkUserAndLoad();
    }, []);

    const checkUserAndLoad = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/login');
            return;
        }
        loadSchools(user.id);
    };

    const loadSchools = async (userId: string) => {
        try {
            const data = await getSchools(userId);
            setSchools(data || []);
        } catch (error) {
            console.error("Failed to load schools", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (schoolData: NewSchool) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (editingSchool) {
            // Update
            const updated = await updateSchool(editingSchool.id, schoolData);
            setSchools(schools.map(s => s.id === updated.id ? updated : s));
        } else {
            // Create
            const created = await addSchool(user.id, schoolData);
            setSchools([...schools, created]);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this application?")) return;
        await deleteSchool(id);
        setSchools(schools.filter(s => s.id !== id));
    };

    const handleEdit = (school: School) => {
        setEditingSchool(school);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingSchool(undefined);
        setIsModalOpen(true);
    };

    // Derived State (Filtering)
    const filteredSchools = useMemo(() => {
        return schools.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                (s.program && s.program.toLowerCase().includes(search.toLowerCase()));
            const matchesFilter = statusFilter === 'all' || s.status === statusFilter;
            return matchesSearch && matchesFilter;
        });
    }, [schools, search, statusFilter]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <GraduationCap className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                        School Tracker
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your university applications, deadlines, and requirements.
                    </p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors shadow-sm active:scale-95"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Application
                </button>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-xl border shadow-sm">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        placeholder="Search universities..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex gap-2">
                        {['all', 'active', 'submitted', 'accepted'].map((st) => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st as any)}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors whitespace-nowrap",
                                    statusFilter === st
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Grid */}
            {filteredSchools.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/20">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                        <GraduationCap className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">No applications found</h3>
                    <p className="text-muted-foreground mb-4">
                        {search ? "Try adjusting your search filters." : "Start tracking your first university application."}
                    </p>
                    {!search && (
                        <button
                            onClick={handleCreate}
                            className="px-4 py-2 text-primary font-medium hover:underline"
                        >
                            + Add your first school
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSchools.map((school) => (
                        <SchoolCard
                            key={school.id}
                            school={school}
                            onUpdate={(updated) => setSchools(schools.map(s => s.id === updated.id ? updated : s))}
                            onDelete={handleDelete}
                            onEdit={handleEdit}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            <EditSchoolModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                school={editingSchool}
            />
        </div>
    );
}
