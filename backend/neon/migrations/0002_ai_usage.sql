-- Daily per-user cap on paid provider calls (AI summary, transcription,
-- YouTube transcripts). The API functions call consume_ai_quota() through
-- the Data API with the caller's own JWT, so the count is keyed on the JWT's
-- sub by the database itself and the server needs no database credentials.
--
-- Users can't touch ai_usage directly: no grants, RLS on with no policies.
-- The only write path is consume_ai_quota() (security definer), which can
-- only ever add to the caller's own count — calling it via the Data API
-- yourself just spends your own quota.

create table if not exists ai_usage (
  -- Filled from the JWT like every other table. Resolved when this script
  -- (run as the owner) creates the table — see the note in 0001_init.sql.
  user_id text not null default auth.user_id(),
  day date not null default (now() at time zone 'utc')::date,
  requests integer not null default 0,
  primary key (user_id, day)
);

revoke all on ai_usage from anonymous, authenticated;
alter table ai_usage enable row level security;

-- Counts one request for today (UTC) and returns how many remain, or NULL
-- when the limit is already reached (nothing is counted then). Atomic: the
-- upsert takes the row lock, so concurrent requests can't overshoot.
-- Keep the limit in sync with DAILY_AI_LIMIT in backend/src/quota.ts.
create or replace function consume_ai_quota()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  daily_limit constant integer := 5;
  used integer;
begin
  insert into ai_usage as u (requests) values (1)
  on conflict (user_id, day) do update set requests = u.requests + 1
    where u.requests < daily_limit
  returning u.requests into used;
  if used is null then
    return null;
  end if;
  return daily_limit - used;
end;
$$;

revoke all on function consume_ai_quota() from public, anonymous, authenticated;
grant execute on function consume_ai_quota() to authenticated;
