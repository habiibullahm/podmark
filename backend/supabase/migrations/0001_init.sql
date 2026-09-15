-- PodMark Phase 1 schema: one table per client store, each scoped to its
-- owner via Row Level Security. No foreign keys between tables — sync
-- upserts per store, and FK ordering would leave the client wedged on a
-- partial failure. Deletes are soft (deleted_at) so a device that was
-- offline when a record was deleted elsewhere can never resurrect it.

-- Maintains updated_at on every row this trigger is attached to, so a
-- client's own updatedAt is never the only clock last-write-wins can trust.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists episodes (
  user_id uuid not null default auth.uid(),
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
  user_id uuid not null default auth.uid(),
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
  user_id uuid not null default auth.uid(),
  episode_id text not null,
  text text not null default '',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, episode_id)
);

create table if not exists ai_summaries (
  user_id uuid not null default auth.uid(),
  episode_id text not null,
  bullets text[] not null default '{}',
  error text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, episode_id)
);

create table if not exists folders (
  user_id uuid not null default auth.uid(),
  id text not null,
  name text not null,
  color text not null,
  episode_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists settings (
  user_id uuid not null default auth.uid(),
  daily_goal_target integer not null default 30,
  notifications_enabled boolean not null default true,
  export_format text not null default 'obsidian',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id)
);

create table if not exists activity (
  user_id uuid not null default auth.uid(),
  date text not null,
  minutes numeric not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, date)
);

create table if not exists progress (
  user_id uuid not null default auth.uid(),
  episode_id text not null,
  seconds numeric not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, episode_id)
);

-- One trigger per table, all sharing the same function above.
do $$
declare
  t text;
begin
  foreach t in array array['episodes', 'notes', 'freeform_notes', 'ai_summaries', 'folders', 'settings', 'activity', 'progress']
  loop
    execute format(
      'drop trigger if exists set_updated_at on %I; create trigger set_updated_at before update on %I for each row execute function set_updated_at();',
      t, t
    );
  end loop;
end $$;

-- Row Level Security: every table readable/writable only by its own owner.
do $$
declare
  t text;
begin
  foreach t in array array['episodes', 'notes', 'freeform_notes', 'ai_summaries', 'folders', 'settings', 'activity', 'progress']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists owner_access on %I;', t);
    execute format(
      'create policy owner_access on %I using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t
    );
  end loop;
end $$;
