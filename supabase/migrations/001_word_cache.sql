-- VidVocab Phase 1: shared word/clip cache with anon + RLS (no service_role)
-- Run in Supabase SQL Editor.

create table if not exists public.word_query_cache (
  word_normalized text not null,
  lang_hint text not null default 'auto',
  definition_json jsonb not null,
  clips_json jsonb,
  fallback_story jsonb,
  match_mode text not null check (match_mode in ('exact', 'synonym', 'story')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint word_query_cache_pkey primary key (word_normalized, lang_hint),
  constraint definition_json_size check (pg_column_size(definition_json) < 20000),
  constraint clips_json_size check (clips_json is null or pg_column_size(clips_json) < 100000),
  constraint fallback_story_size check (fallback_story is null or pg_column_size(fallback_story) < 10000)
);

create index if not exists word_query_cache_expires_idx
  on public.word_query_cache (expires_at);

alter table public.word_query_cache enable row level security;

-- Drop old policies if re-running
drop policy if exists "anon_select_fresh_cache" on public.word_query_cache;
drop policy if exists "anon_insert_cache" on public.word_query_cache;
drop policy if exists "anon_update_cache" on public.word_query_cache;

create policy "anon_select_fresh_cache"
  on public.word_query_cache
  for select
  to anon, authenticated
  using (expires_at > now());

create policy "anon_insert_cache"
  on public.word_query_cache
  for insert
  to anon, authenticated
  with check (true);

create policy "anon_update_cache"
  on public.word_query_cache
  for update
  to anon, authenticated
  using (true)
  with check (true);

-- No DELETE policy for anon/authenticated (denied by default with RLS).

grant select, insert, update on public.word_query_cache to anon, authenticated;
