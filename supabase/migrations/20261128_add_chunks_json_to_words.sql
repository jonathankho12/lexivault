-- LexiVault Learning by Chunks (Lexical Chunking) Migration
-- Safe and idempotent: run once in your Supabase SQL Editor.

alter table public.words
  add column if not exists chunks_json jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
