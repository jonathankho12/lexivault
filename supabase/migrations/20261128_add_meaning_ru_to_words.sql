-- Add optional Russian word meaning column to public.words (idempotent).
-- Safe to run on existing LexiVault Supabase databases; app also degrades gracefully if not yet applied.

alter table public.words
  add column if not exists meaning_ru text;

notify pgrst, 'reload schema';
