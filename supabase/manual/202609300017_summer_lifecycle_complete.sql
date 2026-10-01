-- FLOP RESET V2.4 — SUMMER 2026 LIFECYCLE COMPLETION
--
-- Marks the verified lifecycle fact that Summer is over. It deliberately does
-- not imply that identities, phases, placements, roster snapshots, awards, or
-- Final Regular Season Power have been reconciled.

begin;
set local lock_timeout = '5s';
lock table public.competitions in share row exclusive mode;
lock table public.competition_seasons in share row exclusive mode;

do $$
declare
  summer_season_id bigint;
begin
  if to_regclass('public.competition_seasons') is null then
    raise exception 'Migration 015 is required';
  end if;

  select season_id into summer_season_id
  from public.competition_seasons
  where lower(trim(league_name)) = 'the rivalry'
    and lower(trim(season_name)) = 'summer circuit'
    and season_year = 2026;

  if summer_season_id is null then
    raise exception 'Summer 2026 season is missing';
  end if;
  if (select count(*) from public.competition_seasons where lower(trim(league_name)) = 'the rivalry' and lower(trim(season_name)) = 'summer circuit' and season_year = 2026) <> 1 then
    raise exception 'Summer 2026 season identity is ambiguous';
  end if;
  if (select count(*) from public.competitions where id in (1,2) and season_id = summer_season_id) <> 2 then
    raise exception 'Competitions 1 and 2 are not both attached to Summer 2026';
  end if;
  if exists (
    select 1 from public.competitions
    where id in (1,2)
      and (lower(trim(league_name)) <> 'the rivalry'
        or lower(trim(circuit_name)) <> 'summer circuit'
        or season_year <> 2026
        or format not in ('2v2','3v3'))
  ) then
    raise exception 'Summer competition identity drifted';
  end if;
end $$;

create schema if not exists fr_release_backup;
create table if not exists fr_release_backup.summer_lifecycle_competitions_20260930 (
  competition_id bigint primary key,
  before_row jsonb not null,
  captured_at timestamptz not null default now()
);
create table if not exists fr_release_backup.summer_lifecycle_season_20260930 (
  season_id bigint primary key,
  before_row jsonb not null,
  captured_at timestamptz not null default now()
);

insert into fr_release_backup.summer_lifecycle_competitions_20260930 (competition_id, before_row)
select id, to_jsonb(c) from public.competitions c where id in (1,2)
on conflict (competition_id) do nothing;

insert into fr_release_backup.summer_lifecycle_season_20260930 (season_id, before_row)
select season_id, to_jsonb(s)
from public.competition_seasons s
where lower(trim(league_name)) = 'the rivalry'
  and lower(trim(season_name)) = 'summer circuit'
  and season_year = 2026
on conflict (season_id) do nothing;

do $$
begin
  if (select count(*) from fr_release_backup.summer_lifecycle_competitions_20260930) <> 2
     or (select count(*) from fr_release_backup.summer_lifecycle_season_20260930) <> 1 then
    raise exception 'Summer lifecycle before-image capture failed';
  end if;
end $$;

update public.competitions
set status = 'completed', current_stage = 'completed'
where id in (1,2);

update public.competition_seasons
set status = 'completed', updated_at = now()
where lower(trim(league_name)) = 'the rivalry'
  and lower(trim(season_name)) = 'summer circuit'
  and season_year = 2026;

do $$
begin
  if (select count(*) from public.competitions where id in (1,2) and status = 'completed' and current_stage = 'completed') <> 2
     or (select count(*) from public.competition_seasons where lower(trim(league_name)) = 'the rivalry' and lower(trim(season_name)) = 'summer circuit' and season_year = 2026 and status = 'completed') <> 1 then
    raise exception 'Summer lifecycle postflight failed';
  end if;
end $$;

commit;
