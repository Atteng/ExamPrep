export type BandScore = 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 | 5.5 | 6;

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

export function roundToNearestHalf(value: number): BandScore {
    const clamped = clamp(value, 1, 6);
    const rounded = Math.round(clamped * 2) / 2;
    return rounded as BandScore;
}

/**
 * Derives a 1–6 band score (0.5 increments) from an average percent (0–100).
 * This is a local approximation for practice; ETS provides official scoring on score reports.
 */
export function bandFromPercent(averagePercent: number): BandScore {
    const pct = clamp(averagePercent, 0, 100) / 100;
    const raw = 1 + pct * 5;
    return roundToNearestHalf(raw);
}

type ObjectiveSection = 'reading' | 'listening' | 'writing' | 'speaking';

type Range = { min: number; max: number; band: BandScore };

// From "TOEFL iBT Overview New Format" Table 3 (0–30 scale).
const SECTION_CONCORDANCE_0_30: Record<ObjectiveSection, Range[]> = {
    reading: [
        { band: 6, min: 29, max: 30 },
        { band: 5.5, min: 27, max: 28 },
        { band: 5, min: 24, max: 26 },
        { band: 4.5, min: 22, max: 23 },
        { band: 4, min: 18, max: 21 },
        { band: 3.5, min: 12, max: 17 },
        { band: 3, min: 6, max: 11 },
        { band: 2.5, min: 4, max: 5 },
        { band: 2, min: 3, max: 3 },
        { band: 1.5, min: 2, max: 2 },
        { band: 1, min: 0, max: 1 }
    ],
    listening: [
        { band: 6, min: 28, max: 30 },
        { band: 5.5, min: 26, max: 27 },
        { band: 5, min: 22, max: 25 },
        { band: 4.5, min: 20, max: 21 },
        { band: 4, min: 17, max: 19 },
        { band: 3.5, min: 13, max: 16 },
        { band: 3, min: 9, max: 12 },
        { band: 2.5, min: 6, max: 8 },
        { band: 2, min: 4, max: 5 },
        { band: 1.5, min: 2, max: 3 },
        { band: 1, min: 0, max: 1 }
    ],
    // Note: the doc’s Table 1 says Writing raw is 0–20, but Table 3 presents a 0–30 concordance.
    // For internal practice, we scale objective writing to 0–30 before mapping bands.
    writing: [
        { band: 6, min: 29, max: 30 },
        { band: 5.5, min: 27, max: 28 },
        { band: 5, min: 24, max: 26 },
        { band: 4.5, min: 21, max: 23 },
        { band: 4, min: 17, max: 20 },
        { band: 3.5, min: 15, max: 16 },
        { band: 3, min: 13, max: 14 },
        { band: 2.5, min: 10, max: 12 },
        { band: 2, min: 5, max: 9 },
        { band: 1.5, min: 3, max: 6 },
        { band: 1, min: 0, max: 4 }
    ],
    speaking: [
        { band: 6, min: 28, max: 30 },
        { band: 5.5, min: 27, max: 27 },
        { band: 5, min: 25, max: 26 },
        { band: 4.5, min: 23, max: 24 },
        { band: 4, min: 20, max: 22 },
        { band: 3.5, min: 18, max: 19 },
        { band: 3, min: 16, max: 17 },
        { band: 2.5, min: 13, max: 15 },
        { band: 2, min: 11, max: 12 },
        { band: 1.5, min: 5, max: 9 },
        { band: 1, min: 0, max: 2 }
    ]
};

export function bandFromScaled030(section: ObjectiveSection, score030: number): BandScore {
    const s = clamp(Math.round(score030), 0, 30);
    const ranges = SECTION_CONCORDANCE_0_30[section];
    const hit = ranges.find(r => s >= r.min && s <= r.max);
    return hit?.band ?? 1;
}

export function bandFromObjectiveRaw(section: ObjectiveSection, rawCorrect: number, rawTotal: number): { band: BandScore; scaled030: number } {
    if (!rawTotal || rawTotal <= 0) return { band: 1, scaled030: 0 };
    const ratio = clamp(rawCorrect / rawTotal, 0, 1);
    const scaled030 = Math.round(ratio * 30);
    return { band: bandFromScaled030(section, scaled030), scaled030 };
}

export function overallBandFromSections(sectionBands: Record<'reading' | 'listening' | 'speaking' | 'writing', number>): BandScore {
    const avg =
        (sectionBands.reading + sectionBands.listening + sectionBands.speaking + sectionBands.writing) / 4;
    return roundToNearestHalf(avg);
}

type ConcordanceRow = {
    band: BandScore;
    overall120Label: string;
    overall120Min: number;
};

// Table 3 (from "TOEFL iBT Overview New Format") includes overall as a minimum with "+" for most bands.
const CONCORDANCE: ConcordanceRow[] = [
    { band: 6, overall120Label: "114", overall120Min: 114 },
    { band: 5.5, overall120Label: "107+", overall120Min: 107 },
    { band: 5, overall120Label: "95+", overall120Min: 95 },
    { band: 4.5, overall120Label: "86+", overall120Min: 86 },
    { band: 4, overall120Label: "72+", overall120Min: 72 },
    { band: 3.5, overall120Label: "58+", overall120Min: 58 },
    { band: 3, overall120Label: "44+", overall120Min: 44 },
    { band: 2.5, overall120Label: "34+", overall120Min: 34 },
    { band: 2, overall120Label: "24+", overall120Min: 24 },
    { band: 1.5, overall120Label: "12+", overall120Min: 12 },
    { band: 1, overall120Label: "0+", overall120Min: 0 },
];

export function concordanceOverall120(overallBand: BandScore): { label: string; min: number } {
    const row = CONCORDANCE.find(r => r.band === overallBand);
    if (!row) return { label: "", min: 0 };
    return { label: row.overall120Label, min: row.overall120Min };
}
