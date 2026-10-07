-- FLOP RESET V2.4 — OPENING WEEK SCHEDULE OPERATIONS
-- Additive only. Does not create fixtures, activate Fall, initialize Power,
-- alter Summer, or enable automatic Rivalry apply.

begin;
set local lock_timeout = '5s';

alter table public.scheduled_matches add column if not exists competition_entry_id bigint references public.competition_entries(entry_id) on delete restrict;
alter table public.scheduled_matches add column if not exists source_provider text;
alter table public.scheduled_matches add column if not exists source_external_id text;
alter table public.scheduled_matches add column if not exists source_url text;
alter table public.scheduled_matches add column if not exists timezone text;
alter table public.scheduled_matches add column if not exists scheduled_local_time time;
alter table public.scheduled_matches add column if not exists scheduled_time_source text not null default 'tbd';
alter table public.scheduled_matches add column if not exists scheduled_time_locked boolean not null default false;
alter table public.scheduled_matches add column if not exists best_of integer;
alter table public.scheduled_matches add column if not exists competition_phase text;
alter table public.scheduled_matches add column if not exists stage_label text;
alter table public.scheduled_matches add column if not exists tier text;
alter table public.series add column if not exists scheduled_match_id bigint references public.scheduled_matches(scheduled_id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.scheduled_matches'::regclass and conname = 'scheduled_matches_best_of_valid') then
    alter table public.scheduled_matches add constraint scheduled_matches_best_of_valid check (best_of is null or (best_of > 0 and best_of % 2 = 1)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.scheduled_matches'::regclass and conname = 'scheduled_matches_phase_valid') then
    alter table public.scheduled_matches add constraint scheduled_matches_phase_valid check (competition_phase is null or competition_phase in ('regular_season', 'playoffs')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.scheduled_matches'::regclass and conname = 'scheduled_matches_status_valid') then
    alter table public.scheduled_matches add constraint scheduled_matches_status_valid check (status in ('scheduled', 'postponed', 'cancelled', 'completed')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.scheduled_matches'::regclass and conname = 'scheduled_matches_time_source_valid') then
    alter table public.scheduled_matches add constraint scheduled_matches_time_source_valid check (scheduled_time_source in ('tbd', 'manual', 'source')) not valid;
  end if;
end $$;

create unique index if not exists scheduled_matches_source_identity_unique
  on public.scheduled_matches (competition_id, lower(source_provider), source_external_id)
  where source_provider is not null and source_external_id is not null;

create unique index if not exists scheduled_matches_verified_tuple_unique
  on public.scheduled_matches (competition_id, competition_entry_id, opponent_id, match_date, competition_phase)
  where source_external_id is null and competition_entry_id is not null and opponent_id is not null and competition_phase is not null;

create unique index if not exists series_scheduled_match_unique
  on public.series (scheduled_match_id)
  where scheduled_match_id is not null;

create or replace function public.create_verified_scheduled_match(payload jsonb)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  entry_row public.competition_entries%rowtype;
  competition_row public.competitions%rowtype;
  new_id bigint;
  provider text := nullif(trim(payload->>'source_provider'), '');
  external_id text := nullif(trim(payload->>'source_external_id'), '');
  local_time time := nullif(trim(payload->>'scheduled_local_time'), '')::time;
begin
  if not coalesce((auth.jwt() -> 'app_metadata' ->> 'site_admin')::boolean, false) then
    raise exception 'site_admin authorization required';
  end if;
  select * into entry_row from public.competition_entries where entry_id = (payload->>'competition_entry_id')::bigint;
  if not found or entry_row.competition_id <> (payload->>'competition_id')::bigint or entry_row.fr_team_id is distinct from (payload->>'flop_reset_team_id')::bigint then
    raise exception 'Competition entry does not match the selected competition and canonical team';
  end if;
  select * into competition_row from public.competitions where id = entry_row.competition_id;
  if competition_row.id is null then raise exception 'Competition not found'; end if;
  if not exists (select 1 from public.opponents where opponent_id = (payload->>'opponent_id')::bigint) then
    raise exception 'Canonical opponent not found';
  end if;
  if external_id is not null and provider is null then
    raise exception 'A source provider is required when a stable match ID is supplied';
  end if;
  if nullif(trim(payload->>'source_url'), '') is not null and (payload->>'source_url') !~* '^https://' then
    raise exception 'Source URL must use HTTPS';
  end if;
  if nullif(trim(payload->>'timezone'), '') is null then
    raise exception 'A timezone is required even while the exact time is TBD';
  end if;
  if (payload->>'competition_phase') not in ('regular_season', 'playoffs') then raise exception 'Invalid competition phase'; end if;
  if (payload->>'best_of')::integer < 1 or (payload->>'best_of')::integer % 2 = 0 then raise exception 'Best-of must be a positive odd number'; end if;

  insert into public.scheduled_matches (
    competition_id, competition_entry_id, flop_reset_team_id, opponent_id, opponent_name,
    match_date, match_time, scheduled_local_time, scheduled_time_source, scheduled_time_locked,
    starts_at, timezone, best_of, competition_phase, stage_label, tier,
    source_provider, source_external_id, source_url, status, notes
  ) values (
    competition_row.id, entry_row.entry_id, entry_row.fr_team_id, (payload->>'opponent_id')::bigint,
    (select canonical_name from public.opponents where opponent_id = (payload->>'opponent_id')::bigint),
    (payload->>'match_date')::date, case when local_time is null then null else to_char(local_time, 'HH24:MI') end,
    local_time, case when local_time is null then 'tbd' else 'manual' end, true,
    nullif(payload->>'starts_at', '')::timestamptz,
    trim(payload->>'timezone'), (payload->>'best_of')::integer, payload->>'competition_phase',
    nullif(trim(payload->>'stage_label'), ''), entry_row.tier, provider, external_id,
    nullif(trim(payload->>'source_url'), ''), 'scheduled', nullif(trim(payload->>'notes'), '')
  ) returning scheduled_id into new_id;
  return new_id;
exception
  when unique_violation then
    raise exception 'Scheduled match already exists or conflicts with an existing source identity';
end;
$$;

create or replace function public.protect_owner_managed_schedule_time()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.scheduled_time_locked
     and row(old.match_time, old.scheduled_local_time, old.timezone, old.scheduled_time_source, old.scheduled_time_locked)
         is distinct from
         row(new.match_time, new.scheduled_local_time, new.timezone, new.scheduled_time_source, new.scheduled_time_locked)
     and coalesce(current_setting('app.owner_schedule_time_edit', true), '') <> 'true' then
    raise exception 'Owner-managed schedule time is locked; use set_scheduled_match_local_time';
  end if;
  return new;
end;
$$;

drop trigger if exists scheduled_matches_protect_owner_time on public.scheduled_matches;
create trigger scheduled_matches_protect_owner_time
before update of match_time, scheduled_local_time, timezone, scheduled_time_source, scheduled_time_locked on public.scheduled_matches
for each row execute function public.protect_owner_managed_schedule_time();

create or replace function public.set_scheduled_match_local_time(
  p_scheduled_id bigint,
  p_local_time time,
  p_timezone text
)
returns public.scheduled_matches
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_row public.scheduled_matches%rowtype;
begin
  if not coalesce((auth.jwt() -> 'app_metadata' ->> 'site_admin')::boolean, false) then
    raise exception 'site_admin authorization required';
  end if;
  if nullif(trim(p_timezone), '') is null then
    raise exception 'Timezone is required';
  end if;
  perform set_config('app.owner_schedule_time_edit', 'true', true);
  update public.scheduled_matches
  set scheduled_local_time = p_local_time,
      match_time = case when p_local_time is null then null else to_char(p_local_time, 'HH24:MI') end,
      timezone = trim(p_timezone),
      starts_at = null,
      scheduled_time_source = case when p_local_time is null then 'tbd' else 'manual' end,
      scheduled_time_locked = true
  where scheduled_id = p_scheduled_id
  returning * into updated_row;
  if not found then raise exception 'Scheduled match not found'; end if;
  perform set_config('app.owner_schedule_time_edit', '', true);
  return updated_row;
end;
$$;

create or replace function public.sync_schedule_status_from_series()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.scheduled_match_id is not null then
      update public.scheduled_matches set status = 'scheduled' where scheduled_id = old.scheduled_match_id;
    end if;
    return old;
  end if;
  if new.scheduled_match_id is not null then
    update public.scheduled_matches set status = 'completed' where scheduled_id = new.scheduled_match_id;
  end if;
  if tg_op = 'UPDATE' and old.scheduled_match_id is distinct from new.scheduled_match_id and old.scheduled_match_id is not null then
    update public.scheduled_matches set status = 'scheduled' where scheduled_id = old.scheduled_match_id;
  end if;
  return new;
end;
$$;

drop trigger if exists series_schedule_status_sync on public.series;
create trigger series_schedule_status_sync
after insert or update of scheduled_match_id or delete on public.series
for each row execute function public.sync_schedule_status_from_series();

revoke all on function public.create_verified_scheduled_match(jsonb) from public, anon;
grant execute on function public.create_verified_scheduled_match(jsonb) to authenticated;
revoke all on function public.set_scheduled_match_local_time(bigint, time, text) from public, anon;
grant execute on function public.set_scheduled_match_local_time(bigint, time, text) to authenticated;
revoke all on function public.sync_schedule_status_from_series() from public, anon, authenticated;
revoke all on function public.protect_owner_managed_schedule_time() from public, anon, authenticated;

comment on function public.create_verified_scheduled_match(jsonb) is 'Fail-closed site-admin schedule ingestion. Stable source identity wins; unresolved opponents are rejected.';
comment on function public.set_scheduled_match_local_time(bigint, time, text) is 'Site-admin-only owner time enrichment. Updates the existing fixture and locks its time against source overwrite.';
comment on column public.series.scheduled_match_id is 'Original verified fixture consumed by this completed competitive series.';

commit;
