-- SQL script to delete all listening questions from the database
-- Run this in your Supabase SQL editor or database client

DELETE FROM generated_questions 
WHERE section = 'listening';

-- Verify deletion
SELECT COUNT(*) as remaining_listening_questions 
FROM generated_questions 
WHERE section = 'listening';
