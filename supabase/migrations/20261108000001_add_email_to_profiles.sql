-- Add email column to profiles table for email-based frictionless student sign in
alter table if exists public.profiles add column if not exists email text;
create index if not exists idx_profiles_email on public.profiles(email);

-- Ensure public read and insert/upsert policies exist
create policy "Allow update profiles" on public.profiles
  for update using (true);
