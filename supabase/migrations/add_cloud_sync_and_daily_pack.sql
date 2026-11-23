-- LexiVault Idempotent Cloud Sync, Daily Pack & Smart Flashcards Migration
-- Safe to run multiple times in the Supabase SQL Editor.

-- 1. Upgrade public.words for bilingual definitions, CEFR, and same-day non-repeating Flashcards tracking
alter table public.words
  add column if not exists pronunciation text,
  add column if not exists ipa text,
  add column if not exists meaning_en text,
  add column if not exists cefr text,
  add column if not exists last_reviewed_date text,
  add column if not exists review_count integer not null default 0,
  add column if not exists next_review_at timestamptz,
  add column if not exists interval_days integer not null default 0,
  add column if not exists ease_factor numeric(4,2) not null default 2.50,
  add column if not exists repetitions integer not null default 0;

create index if not exists idx_words_user_last_reviewed
  on public.words (user_id, last_reviewed_date);

-- 2. Ensure public.study_logs has Daily Rings & XP columns
alter table public.study_logs
  add column if not exists vocab_today integer not null default 0,
  add column if not exists recall_today integer not null default 0,
  add column if not exists ielts_today integer not null default 0,
  add column if not exists xp_earned integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

-- 3. Dedicated Per-User Cloud Profile & Settings (XP, Mastery Rank, Daily Quotas, Ring Targets)
create table if not exists public.user_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  xp integer not null default 0,
  mastery_rank text not null default 'Observer',
  daily_words_quota integer not null default 10,
  daily_idioms_quota integer not null default 5,
  auto_show_daily_pack boolean not null default true,
  ring_targets_json jsonb not null default '{"vocab":3,"recall":15,"ielts":1}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "Users can view own user_profiles" on public.user_profiles;
create policy "Users can view own user_profiles"
  on public.user_profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own user_profiles" on public.user_profiles;
create policy "Users can insert own user_profiles"
  on public.user_profiles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own user_profiles" on public.user_profiles;
create policy "Users can update own user_profiles"
  on public.user_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own user_profiles" on public.user_profiles;
create policy "Users can delete own user_profiles"
  on public.user_profiles for delete to authenticated
  using (auth.uid() = user_id);

-- 4. Daily Learning Pack (Per-User Daily Batch & Completion Progress keyed by YYYY-MM-DD)
create table if not exists public.daily_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pack_date text not null,
  words_quota integer not null default 10,
  idioms_quota integer not null default 5,
  items_json jsonb not null default '[]'::jsonb,
  completed_terms text[] not null default '{}',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_packs_user_date_key unique (user_id, pack_date)
);

create index if not exists idx_daily_packs_user_date
  on public.daily_packs (user_id, pack_date desc);

alter table public.daily_packs enable row level security;

drop policy if exists "Users can view own daily_packs" on public.daily_packs;
create policy "Users can view own daily_packs"
  on public.daily_packs for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own daily_packs" on public.daily_packs;
create policy "Users can insert own daily_packs"
  on public.daily_packs for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own daily_packs" on public.daily_packs;
create policy "Users can update own daily_packs"
  on public.daily_packs for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own daily_packs" on public.daily_packs;
create policy "Users can delete own daily_packs"
  on public.daily_packs for delete to authenticated
  using (auth.uid() = user_id);

-- 5. Enable Supabase Realtime for user_profiles and daily_packs
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_profiles'
  ) then
    alter publication supabase_realtime add table public.user_profiles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_packs'
  ) then
    alter publication supabase_realtime add table public.daily_packs;
  end if;
end $$;
