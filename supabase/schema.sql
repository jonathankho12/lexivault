-- LexiVault Multi-User Supabase Schema & Strict Row Level Security (RLS)
-- Run this script in your Supabase SQL Editor.
--
-- IMPORTANT for Username + Password Auth:
-- In Supabase Dashboard -> Authentication -> Providers -> Email:
-- Disable "Confirm email" so users can sign up and sign in immediately
-- with Username + Password without needing email verification.

create extension if not exists pgcrypto;

-- 1. Core Vocabulary, Idiom, and Collocation Vault
create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  term text not null,
  type text not null check (type in ('vocab', 'idiom', 'collocation')),
  meaning_id text not null,
  examples_json jsonb not null default '[]'::jsonb,
  synonyms text[] not null default '{}',
  antonyms text[] not null default '{}',
  word_families_json jsonb not null default '[]'::jsonb,
  register text not null default 'Casual' check (register in ('Formal', 'Academic', 'Casual', 'Slang')),
  source_tag text not null default 'Umum',
  audio_us_url text,
  audio_uk_url text,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  last_practiced_at timestamptz,
  next_review_at timestamptz,
  interval_days integer not null default 0,
  ease_factor numeric(4,2) not null default 2.50,
  repetitions integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Daily Discovery Packs (Per-User Sync)
create table if not exists public.daily_discoveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  discovery_date date not null,
  items_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint daily_discoveries_user_date_key unique (user_id, discovery_date)
);

-- 3. Study Activity Logs (Per-User Streak & Activity Analytics)
create table if not exists public.study_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  study_date date not null,
  reviews_count integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  words_added integer not null default 0,
  vocab_today integer not null default 0,
  recall_today integer not null default 0,
  ielts_today integer not null default 0,
  xp_earned integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint study_logs_user_date_key unique (user_id, study_date)
);

-- Idempotent migration guards if upgrading from single-user v1 schema
alter table public.words
  add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  add column if not exists next_review_at timestamptz,
  add column if not exists interval_days integer not null default 0,
  add column if not exists ease_factor numeric(4,2) not null default 2.50,
  add column if not exists repetitions integer not null default 0;

alter table public.daily_discoveries
  add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;

alter table public.study_logs
  add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  add column if not exists vocab_today integer not null default 0,
  add column if not exists recall_today integer not null default 0,
  add column if not exists ielts_today integer not null default 0,
  add column if not exists xp_earned integer not null default 0;

create index if not exists idx_words_user_next_review on public.words (user_id, next_review_at);

alter table public.daily_discoveries drop constraint if exists daily_discoveries_discovery_date_key;
alter table public.study_logs drop constraint if exists study_logs_study_date_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'daily_discoveries_user_date_key'
  ) then
    alter table public.daily_discoveries
      add constraint daily_discoveries_user_date_key unique (user_id, discovery_date);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'study_logs_user_date_key'
  ) then
    alter table public.study_logs
      add constraint study_logs_user_date_key unique (user_id, study_date);
  end if;
end $$;

-- User-Scoped Indexes
create index if not exists idx_words_user_created on public.words (user_id, created_at desc);
create index if not exists idx_words_user_term on public.words (user_id, lower(term));
create index if not exists idx_daily_discoveries_user_date on public.daily_discoveries (user_id, discovery_date);
create index if not exists idx_study_logs_user_date on public.study_logs (user_id, study_date desc);

-- Strict Row Level Security (Per-User Isolation)
alter table public.words enable row level security;
alter table public.daily_discoveries enable row level security;
alter table public.study_logs enable row level security;

-- Drop legacy open policies if present
drop policy if exists "Allow personal workspace access on words" on public.words;
drop policy if exists "Allow personal workspace access on daily_discoveries" on public.daily_discoveries;
drop policy if exists "Allow personal workspace access on study_logs" on public.study_logs;

-- Words policies
drop policy if exists "Users can view own words" on public.words;
create policy "Users can view own words"
  on public.words for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own words" on public.words;
create policy "Users can insert own words"
  on public.words for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own words" on public.words;
create policy "Users can update own words"
  on public.words for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own words" on public.words;
create policy "Users can delete own words"
  on public.words for delete to authenticated
  using (auth.uid() = user_id);

-- Daily discoveries policies
drop policy if exists "Users can view own daily_discoveries" on public.daily_discoveries;
create policy "Users can view own daily_discoveries"
  on public.daily_discoveries for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own daily_discoveries" on public.daily_discoveries;
create policy "Users can insert own daily_discoveries"
  on public.daily_discoveries for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own daily_discoveries" on public.daily_discoveries;
create policy "Users can update own daily_discoveries"
  on public.daily_discoveries for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own daily_discoveries" on public.daily_discoveries;
create policy "Users can delete own daily_discoveries"
  on public.daily_discoveries for delete to authenticated
  using (auth.uid() = user_id);

-- Study logs policies
drop policy if exists "Users can view own study_logs" on public.study_logs;
create policy "Users can view own study_logs"
  on public.study_logs for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own study_logs" on public.study_logs;
create policy "Users can insert own study_logs"
  on public.study_logs for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own study_logs" on public.study_logs;
create policy "Users can update own study_logs"
  on public.study_logs for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own study_logs" on public.study_logs;
create policy "Users can delete own study_logs"
  on public.study_logs for delete to authenticated
  using (auth.uid() = user_id);

-- Real-Time Sync Publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'words'
  ) then
    alter publication supabase_realtime add table public.words;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_discoveries'
  ) then
    alter publication supabase_realtime add table public.daily_discoveries;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_logs'
  ) then
    alter publication supabase_realtime add table public.study_logs;
  end if;
end $$;

-- 4. IELTS Academic Prep Profiles & Attempts (Per-User CEFR & Band Tracking)
create table if not exists public.ielts_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  cefr_level text not null default 'B1' check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  estimated_band numeric(3,1) not null default 0.0,
  reading_band numeric(3,1),
  listening_band numeric(3,1),
  writing_band numeric(3,1),
  speaking_band numeric(3,1),
  xp integer not null default 0,
  mastery_rank text not null default 'Observer',
  placement_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.ielts_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  skill text not null check (skill in ('placement', 'reading', 'listening', 'writing', 'speaking')),
  band_score numeric(3,1) not null,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Idempotent upgrade guards for IELTS Speaking, XP, and Mastery Rank
alter table public.ielts_profiles
  add column if not exists speaking_band numeric(3,1),
  add column if not exists xp integer not null default 0,
  add column if not exists mastery_rank text not null default 'Observer';

alter table public.ielts_attempts drop constraint if exists ielts_attempts_skill_check;
alter table public.ielts_attempts
  add constraint ielts_attempts_skill_check
  check (skill in ('placement', 'reading', 'listening', 'writing', 'speaking'));

create index if not exists idx_ielts_attempts_user_created on public.ielts_attempts (user_id, created_at desc);
create index if not exists idx_ielts_attempts_user_skill on public.ielts_attempts (user_id, skill);

alter table public.ielts_profiles enable row level security;
alter table public.ielts_attempts enable row level security;

drop policy if exists "Users can view own ielts_profiles" on public.ielts_profiles;
create policy "Users can view own ielts_profiles"
  on public.ielts_profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own ielts_profiles" on public.ielts_profiles;
create policy "Users can insert own ielts_profiles"
  on public.ielts_profiles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own ielts_profiles" on public.ielts_profiles;
create policy "Users can update own ielts_profiles"
  on public.ielts_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own ielts_profiles" on public.ielts_profiles;
create policy "Users can delete own ielts_profiles"
  on public.ielts_profiles for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can view own ielts_attempts" on public.ielts_attempts;
create policy "Users can view own ielts_attempts"
  on public.ielts_attempts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own ielts_attempts" on public.ielts_attempts;
create policy "Users can insert own ielts_attempts"
  on public.ielts_attempts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own ielts_attempts" on public.ielts_attempts;
create policy "Users can update own ielts_attempts"
  on public.ielts_attempts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own ielts_attempts" on public.ielts_attempts;
create policy "Users can delete own ielts_attempts"
  on public.ielts_attempts for delete to authenticated
  using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ielts_profiles'
  ) then
    alter publication supabase_realtime add table public.ielts_profiles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ielts_attempts'
  ) then
    alter publication supabase_realtime add table public.ielts_attempts;
  end if;
end $$;

-- Storage Bucket for Zero-Lag Audio Caching (shared read/cache)
insert into storage.buckets (id, name, public)
values ('audio-cache', 'audio-cache', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read audio-cache" on storage.objects;
create policy "Public read audio-cache"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'audio-cache');

drop policy if exists "Allow insert audio-cache" on storage.objects;
create policy "Allow insert audio-cache"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'audio-cache');

drop policy if exists "Allow update audio-cache" on storage.objects;
create policy "Allow update audio-cache"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'audio-cache')
  with check (bucket_id = 'audio-cache');
