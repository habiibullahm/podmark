-- PodMark schema for Neon (Managed Better Auth + Data API).
-- Ported from the original Supabase migrations (0001_init + 0002_transcripts):
-- same 9 tables, columns, soft deletes and updated_at trigger. Differences:
--   * user_id is text, defaulting to auth.user_id() (pg_session_jwt). Better
--     Auth ids aren't guaranteed UUIDs, and auth.uid() returns NULL for a
--     non-UUID sub — which would silently break every insert.
--   * Policies target the `authenticated` role explicitly; `anonymous` gets
--     no grants at all. No DELETE grant: the client only soft-deletes.
-- Prerequisite: Data API enabled on the branch (creates pg_session_jwt and
-- the authenticated/anonymous roles). Run as the branch owner (neondb_owner).

-- Note: the `auth` schema (pg_session_jwt) is owned by cloud_admin and
-- `authenticated` has no USAGE on it, so a direct `select auth.user_id()`
-- from that role fails. That's fine: the defaults and policies below are
-- resolved when this script (run as the owner) creates them, so they execute
-- for `authenticated` without schema usage. Verified by scripts/db-verify.mjs.

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists episodes (
  user_id text not null default auth.user_id(),
  id text not null,
  title text not null,
  show text not null,
  artwork_gradient text,
  artwork_image_url text,
  duration_sec integer not null default 0,
  progress_sec integer not null default 0,
  status text not null default 'not-started',
  tags text[] not null default '{}',
  published_at text,
  audio_url text,
  source_url text,
  description text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists notes (
  user_id text not null default auth.user_id(),
  id text not null,
  episode_id text not null,
  type text not null,
  timestamp_sec integer not null default 0,
  text text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists freeform_notes (
  user_id text not null default auth.user_id(),
  episode_id text not null,
  text text not null default '',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, episode_id)
);

create table if not exists ai_summaries (
  user_id text not null default auth.user_id(),
  episode_id text not null,
  bullets text[] not null default '{}',
  error text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, episode_id)
);

create table if not exists folders (
  user_id text not null default auth.user_id(),
  id text not null,
  name text not null,
  color text not null,
  episode_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists settings (
  user_id text not null default auth.user_id(),
  daily_goal_target integer not null default 30,
  notifications_enabled boolean not null default true,
  export_format text not null default 'obsidian',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id)
);

create table if not exists activity (
  user_id text not null default auth.user_id(),
  date text not null,
  minutes numeric not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, date)
);

create table if not exists progress (
  user_id text not null default auth.user_id(),
  episode_id text not null,
  seconds numeric not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, episode_id)
);

create table if not exists transcripts (
  user_id text not null default auth.user_id(),
  episode_id text not null,
  segments jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, episode_id)
);

do $$
declare
  t text;
begin
  foreach t in array array['episodes', 'notes', 'freeform_notes', 'ai_summaries', 'folders', 'settings', 'activity', 'progress', 'transcripts']
  loop
    execute format(
      'drop trigger if exists set_updated_at on %I; create trigger set_updated_at before update on %I for each row execute function set_updated_at();',
      t, t
    );
    -- Override the Data API's default grants with the exact set sync needs.
    execute format('revoke all on %I from anonymous, authenticated;', t);
    execute format('grant select, insert, update on %I to authenticated;', t);
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists owner_access on %I;', t);
    execute format(
      'create policy owner_access on %I for all to authenticated using (user_id = auth.user_id()) with check (user_id = auth.user_id());',
      t
    );
  end loop;
end $$;
