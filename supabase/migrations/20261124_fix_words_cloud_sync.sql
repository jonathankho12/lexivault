-- LexiVault Complete Cloud Sync Repair & Schema Migration
-- Safe and idempotent: run this entire script once in your Supabase SQL Editor.
-- Fixes missing tables/columns, legacy CHECK constraints, table GRANTs, RLS policies,
-- and reloads the PostgREST schema cache so Vault words sync across all devices.

create extension if not exists pgcrypto;

-- 1. Ensure public.words exists with full schema
create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  term text not null,
  pronunciation text,
  ipa text,
  cefr text,
  type text not null default 'vocab',
  meaning_id text not null,
  meaning_en text,
  examples_json jsonb not null default '[]'::jsonb,
  synonyms text[] not null default '{}',
  antonyms text[] not null default '{}',
  word_families_json jsonb not null default '[]'::jsonb,
  register text not null default 'Casual',
  source_tag text not null default 'general',
  audio_us_url text,
  audio_uk_url text,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  last_practiced_at timestamptz,
  last_reviewed_date text,
  review_count integer not null default 0,
  next_review_at timestamptz,
  interval_days integer not null default 0,
  ease_factor numeric(4,2) not null default 2.50,
  repetitions integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Add any missing columns on existing public.words installations
alter table public.words
  add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  add column if not exists pronunciation text,
  add column if not exists ipa text,
  add column if not exists cefr text,
  add column if not exists meaning_en text,
  add column if not exists examples_json jsonb not null default '[]'::jsonb,
  add column if not exists synonyms text[] not null default '{}',
  add column if not exists antonyms text[] not null default '{}',
  add column if not exists word_families_json jsonb not null default '[]'::jsonb,
  add column if not exists register text not null default 'Casual',
  add column if not exists source_tag text not null default 'general',
  add column if not exists audio_us_url text,
  add column if not exists audio_uk_url text,
  add column if not exists correct_count integer not null default 0,
  add column if not exists wrong_count integer not null default 0,
  add column if not exists last_practiced_at timestamptz,
  add column if not exists last_reviewed_date text,
  add column if not exists review_count integer not null default 0,
  add column if not exists next_review_at timestamptz,
  add column if not exists interval_days integer not null default 0,
  add column if not exists ease_factor numeric(4,2) not null default 2.50,
  add column if not exists repetitions integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

alter table public.words
  alter column user_id set default auth.uid();

-- 3. Normalize any legacy out-of-range or NULL values before applying CHECK constraints
update public.words
set
  type = case
    when type in ('vocab', 'idiom', 'collocation') then type
    else 'vocab'
  end,
  register = case
    when register in ('Formal', 'Academic', 'Casual', 'Slang') then register
    else 'Casual'
  end,
  cefr = case
    when cefr is not null and upper(btrim(cefr)) in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
      then upper(btrim(cefr))
    else null
  end
where
  type is null
  or type not in ('vocab', 'idiom', 'collocation')
  or register is null
  or register not in ('Formal', 'Academic', 'Casual', 'Slang')
  or (cefr is not null and cefr not in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

-- 4. Replace any overly strict legacy CHECK constraints on public.words
alter table public.words drop constraint if exists words_type_check;
alter table public.words
  add constraint words_type_check
  check (type in ('vocab', 'idiom', 'collocation'));

alter table public.words drop constraint if exists words_register_check;
alter table public.words
  add constraint words_register_check
  check (register in ('Formal', 'Academic', 'Casual', 'Slang'));

alter table public.words drop constraint if exists words_cefr_check;
alter table public.words
  add constraint words_cefr_check
  check (cefr is null or cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

alter table public.words drop constraint if exists words_source_tag_check;

-- 4. Indexes for fast per-user Vault queries & deduplication
create index if not exists idx_words_user_created
  on public.words (user_id, created_at desc);
create index if not exists idx_words_user_term
  on public.words (user_id, lower(term));
create index if not exists idx_words_user_next_review
  on public.words (user_id, next_review_at);
create index if not exists idx_words_user_last_reviewed
  on public.words (user_id, last_reviewed_date);

-- 5. Supporting Cloud Sync Tables (study_logs, user_profiles, daily_packs, daily_discoveries)
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

alter table public.study_logs
  add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  add column if not exists vocab_today integer not null default 0,
  add column if not exists recall_today integer not null default 0,
  add column if not exists ielts_today integer not null default 0,
  add column if not exists xp_earned integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

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

create table if not exists public.daily_discoveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  discovery_date date not null,
  items_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint daily_discoveries_user_date_key unique (user_id, discovery_date)
);

-- Ensure multi-user composite unique constraints exist on legacy v1 upgrades
alter table public.daily_discoveries drop constraint if exists daily_discoveries_discovery_date_key;
alter table public.study_logs drop constraint if exists study_logs_study_date_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'study_logs_user_date_key'
  ) then
    alter table public.study_logs
      add constraint study_logs_user_date_key unique (user_id, study_date);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'daily_packs_user_date_key'
  ) then
    alter table public.daily_packs
      add constraint daily_packs_user_date_key unique (user_id, pack_date);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'daily_discoveries_user_date_key'
  ) then
    alter table public.daily_discoveries
      add constraint daily_discoveries_user_date_key unique (user_id, discovery_date);
  end if;
end $$;

-- 6. Explicit schema & table GRANTs for Supabase authenticated role (+ anon read for health check)
grant usage on schema public to anon, authenticated;
grant select on public.words to anon;
grant select, insert, update, delete on public.words to authenticated;
grant select, insert, update, delete on public.study_logs to authenticated;
grant select, insert, update, delete on public.user_profiles to authenticated;
grant select, insert, update, delete on public.daily_packs to authenticated;
grant select, insert, update, delete on public.daily_discoveries to authenticated;

-- 7. Strict Row Level Security (Per-User Isolation)
alter table public.words enable row level security;
alter table public.study_logs enable row level security;
alter table public.user_profiles enable row level security;
alter table public.daily_packs enable row level security;
alter table public.daily_discoveries enable row level security;

drop policy if exists "Allow personal workspace access on words" on public.words;
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

-- 8. Realtime Publication
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
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_logs'
  ) then
    alter publication supabase_realtime add table public.study_logs;
  end if;

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

-- 9. Reload PostgREST schema cache immediately
notify pgrst, 'reload schema';
