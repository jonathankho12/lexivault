-- LexiVault CEFR Onboarding & Active Level Cloud Sync Migration
-- Safe and idempotent: run in Supabase SQL Editor.

alter table public.user_profiles
  add column if not exists cefr_level text,
  add column if not exists cefr_onboarding_completed boolean not null default false;

alter table public.user_profiles drop constraint if exists user_profiles_cefr_level_check;
alter table public.user_profiles
  add constraint user_profiles_cefr_level_check
  check (cefr_level is null or cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

notify pgrst, 'reload schema';
