-- Add Monetization fields to profiles table (Paystack Version)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT,
ADD COLUMN IF NOT EXISTS paystack_sub_code TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';

-- Index for searching by Paystack Code
CREATE INDEX IF NOT EXISTS idx_profiles_paystack_customer_code 
ON profiles(paystack_customer_code);

-- Create table for user question history (for Shared Library)
-- (Same as before, ensuring it exists)
CREATE TABLE IF NOT EXISTS user_question_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    question_id UUID REFERENCES generated_questions(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, question_id)
);

-- RLS Policies
ALTER TABLE user_question_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own history" ON user_question_history;
CREATE POLICY "Users can insert their own history" 
ON user_question_history FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own history" ON user_question_history;
CREATE POLICY "Users can view their own history" 
ON user_question_history FOR SELECT 
USING (auth.uid() = user_id);
