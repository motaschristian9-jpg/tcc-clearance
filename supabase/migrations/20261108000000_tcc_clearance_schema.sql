-- ==============================================================================
-- TCC Activity Card Clearance System — Database Schema (Supabase / PostgreSQL)
-- Matches Specification: Doc 05 (Database Schema & Storage)
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Departments (8 TCC Academic Units)
create table if not exists public.departments (
  id text primary key, -- e.g. 'CIT', 'CBA', 'CCJPS'
  code text not null unique,
  name text not null,
  created_at timestamptz default now()
);

insert into public.departments (id, code, name) values
  ('CIT', 'CIT', 'College of Information Technology'),
  ('CBA', 'CBA', 'College of Business Administration'),
  ('CED', 'CED', 'College of Education'),
  ('CCJPS', 'CCJPS', 'College of Criminal Justice and Public Safety'),
  ('CHM', 'CHM', 'College of Hospitality Management'),
  ('CAS', 'CAS', 'College of Arts and Sciences'),
  ('COM', 'COM', 'College of Operations Management'),
  ('CLIS', 'CLIS', 'College of Library and Information Science')
on conflict (id) do nothing;

-- 2. Student & Officer Profiles
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  school_id_no text not null unique,
  full_name text not null,
  role text not null check (role in ('student', 'officer', 'head', 'admin')),
  department_id text references public.departments(id),
  section_id text,
  year_level smallint check (year_level between 1 and 5),
  public_key text, -- ECDSA P-256 raw public key (Base64URL)
  photo_url text,  -- Supabase Storage bucket URL
  thumb_data_url text, -- Base64 thumbnail for offline roster downloads
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  photo_status text default 'accepted' check (photo_status in ('accepted', 'needs_retake')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_department on public.profiles(department_id);
create index if not exists idx_profiles_school_id on public.profiles(school_id_no);
create index if not exists idx_profiles_status on public.profiles(status);

-- 3. Events
create table if not exists public.events (
  id text primary key, -- e.g. 'cit-intramurals-2026'
  name text not null,
  academic_year text not null,
  semester text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

insert into public.events (id, name, academic_year, semester, start_date, end_date, is_active) values
  ('cit-intramurals-2026', 'CIT Intramurals 2026', '2025-2026', '2nd Semester', '2026-03-01', '2026-03-05', true)
on conflict (id) do nothing;

-- 4. Event Slots (5 Days x 4 Slots = 20 Slots)
create table if not exists public.event_slots (
  id text primary key, -- e.g. 'day1-morning-in'
  event_id text references public.events(id) on delete cascade,
  day_no smallint not null,
  slot_type text not null, -- 'morning-in', 'morning-out', 'afternoon-in', 'afternoon-out'
  label text not null,
  start_time time,
  end_time time,
  created_at timestamptz default now()
);

-- 5. Attendance Records (The Single Source of Truth for Clearance)
create table if not exists public.attendance_records (
  id text primary key, -- client scan UUID or serial no
  serial_no text not null,
  event_id text not null references public.events(id),
  slot_id text not null references public.event_slots(id),
  student_id text not null,
  venue_id text,
  officer_id text not null,
  scanner_key_id text not null,
  scanned_at timestamptz not null default now(),
  method text not null check (method in ('qr', 'manual', 'receipt')),
  location_flag text not null default 'none',
  distance_m numeric,
  status text not null default 'valid' check (status in ('valid', 'duplicate', 'voided')),
  signature text not null, -- Scanner ECDSA P-256 signature
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_attendance_student_event on public.attendance_records(student_id, event_id);
create index if not exists idx_attendance_slot on public.attendance_records(slot_id);
create index if not exists idx_attendance_serial on public.attendance_records(serial_no);

-- 6. Clearance Final Sign-offs
create table if not exists public.clearance_signoffs (
  id uuid primary key default gen_random_uuid(),
  event_id text references public.events(id),
  student_id text not null,
  department_id text references public.departments(id),
  officer_id text not null,
  signed_at timestamptz default now(),
  remarks text,
  unique (event_id, student_id)
);

-- ==============================================================================
-- Storage Buckets Setup
-- ==============================================================================
insert into storage.buckets (id, name, public) values
  ('student-photos', 'student-photos', true),
  ('officer-signatures', 'officer-signatures', true)
on conflict (id) do nothing;

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.attendance_records enable row level security;
alter table public.clearance_signoffs enable row level security;

-- Public can read approved student profiles for roster & scanning
create policy "Allow read profiles" on public.profiles
  for select using (true);

-- Anyone authenticated or students can register their own profile
create policy "Allow insert profile" on public.profiles
  for insert with check (true);

-- Officers & attendance sync can read and write attendance
create policy "Allow read attendance" on public.attendance_records
  for select using (true);

create policy "Allow insert attendance" on public.attendance_records
  for insert with check (true);

create policy "Allow update attendance" on public.attendance_records
  for update using (true);

