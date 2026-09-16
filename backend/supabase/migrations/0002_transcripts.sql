-- Phase 2: per-episode transcripts. Same shape and RLS pattern as the other
-- per-episode tables in 0001_init.sql (freeform_notes, ai_summaries) — one
-- row per (user, episode), soft-deleted, owner-scoped.

create table if not exists transcripts (
  user_id uuid not null default auth.uid(),
  episode_id text not null,
  segments jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, episode_id)
);

drop trigger if exists set_updated_at on transcripts;
create trigger set_updated_at before update on transcripts for each row execute function set_updated_at();

alter table transcripts enable row level security;
drop policy if exists owner_access on transcripts;
create policy owner_access on transcripts using (auth.uid() = user_id) with check (auth.uid() = user_id);
