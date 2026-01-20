-- Create a table to track used topics per user
create table if not exists topic_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  topic text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add an index for faster lookups based on user_id and date
create index idx_topic_history_user_date on topic_history(user_id, created_at desc);

-- RLS Policies
alter table topic_history enable row level security;

create policy "Users can insert their own topics"
  on topic_history for insert
  with check (auth.uid() = user_id);

create policy "Users can read their own topics"
  on topic_history for select
  using (auth.uid() = user_id);
