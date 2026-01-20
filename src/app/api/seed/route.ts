import { NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'extras', 'examprep_backup_2026-01-10.json');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const backupData = JSON.parse(fileContent);

        let sqlContent = `-- Full V1 Content Import\nINSERT INTO public.content_library (content_type, text_content, metadata) VALUES \n`;
        const values = [];

        for (const item of backupData) {
            let type = '';
            let content = '';
            let meta = { source: 'v1_full', original_id: item.id, ...item.metadata };

            // Reading
            if (item.section === 'reading' && item.passage) {
                type = item.type === 'complete_words' ? 'reading_passage_short' : 'reading_passage_academic';
                content = item.passage;
            }
            // Listening
            else if (item.section === 'listening' && item.passage) {
                type = 'listening_script_' + (item.type.includes('conversation') ? 'conversation' : 'lecture');
                content = item.passage;
            }
            // Speaking/Writing Topics
            else if ((item.section === 'speaking' || item.section === 'writing') && item.prompt) {
                type = `topic_${item.section}`;
                content = item.prompt;
            }

            if (type && content) {
                // Escape single quotes for SQL
                const safeContent = content.replace(/'/g, "''");
                const safeMeta = JSON.stringify(meta).replace(/'/g, "''");
                values.push(`('${type}', '${safeContent}', '${safeMeta}')`);
            }
        }

        sqlContent += values.join(',\n') + ';';

        // Write to file
        const outPath = path.join(process.cwd(), 'seed_full.sql');
        fs.writeFileSync(outPath, sqlContent);

        return NextResponse.json({
            success: true,
            message: `Generated seed_full.sql with ${values.length} items.`,
            path: outPath
        });

    } catch (error: any) {
        console.error("Generator Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
