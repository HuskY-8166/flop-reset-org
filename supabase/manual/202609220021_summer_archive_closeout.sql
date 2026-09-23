-- PREPARED ONLY. FINAL STEP ONLY.
-- This transaction intentionally fails until identity, roster, bracket, and
-- Final Regular Season Power prerequisites are complete. It creates no facts.

begin;
set local lock_timeout = '5s';
lock table public.competitions in share row exclusive mode;

do $$
declare
  summer_season_id bigint;
  expected_team_count integer;
  snapshot_team_count integer;
begin
  if to_regclass('public.competition_seasons') is null then
    raise exception 'Migration 015 is required';
  end if;
  if to_regclass('public.team_rating_snapshots') is null then
    raise exception 'Power snapshot schema is not installed';
  end if;

  select season_id into summer_season_id
  from public.competition_seasons
  where lower(trim(league_name)) = 'the rivalry'
    and lower(trim(season_name)) = 'summer circuit'
    and season_year = 2026;

  if summer_season_id is null then
    raise exception 'Summer 2026 archive season is missing';
  end if;
  if (select count(*) from public.competitions where id in (1,2) and season_id = summer_season_id) <> 2 then
    raise exception 'Competitions 1 and 2 are not both linked to the Summer season';
  end if;

  if (select count(*) from public.series where series_id between 32 and 46 and competition_id = 2 and competition_phase = 'regular_season') <> 15
     or (select count(*) from public.league_matches where id between 767 and 1168 and competition_id in (1,2) and competition_phase = 'regular_season') <> 402 then
    raise exception 'Summer phase backfill is incomplete';
  end if;

  -- The Bozo Collective remains deliberately NULL today, so this guard blocks
  -- completion until series 42 has authenticated source identity evidence.
  if exists (select 1 from public.series where series_id between 32 and 46 and opponent_id is null) then
    raise exception 'Summer series identity reconciliation is incomplete';
  end if;
  if exists (
    select 1 from public.competition_entries
    where competition_id in (1,2) and fr_team_id is null and opponent_id is null
  ) then
    raise exception 'Summer competition-entry identity reconciliation is incomplete';
  end if;
  if exists (
    select 1
    from public.competition_entries e
    where e.competition_id in (1,2)
      and e.registration_status = 'registered'
      and e.status = 'active'
      and not exists (
        select 1 from public.competition_roster_members rm
        where rm.entry_id = e.entry_id and rm.is_current
      )
  ) then
    raise exception 'Verified Summer roster snapshots are incomplete';
  end if;

  if not exists (select 1 from public.playoff_matches where playoff_match_id = 73 and score_a = 3 and score_b = 4 and winner_side = 2 and status = 'final')
     or not exists (select 1 from public.playoff_matches where playoff_match_id = 66 and score_a = 4 and score_b = 2 and winner_side = 1 and status = 'final')
     or not exists (select 1 from public.playoff_matches where playoff_match_id = 68 and score_a = 4 and score_b = 1 and winner_side = 1 and status = 'final')
     or not exists (select 1 from public.playoff_matches where playoff_match_id = 70 and competition_entry_a_id = 136 and competition_entry_b_id = 122 and status = 'tbd' and score_a is null and score_b is null) then
    raise exception 'Required source-verified playoff reconciliation is incomplete';
  end if;
  if exists (
    select 1 from public.playoff_matches
    where playoff_match_id in (66,68,70,73)
      and (series_id is not null or is_forfeit or is_bye)
  ) then
    raise exception 'Bracket-only reconciliation unexpectedly contains statistical series/forfeit/BYE data';
  end if;

  if exists (select 1 from public.playoff_brackets where bracket_id = 2 and status <> 'hidden') then
    raise exception 'Blank bracket 2 is neither hidden nor removed';
  end if;

  if (select count(distinct model_version) from public.team_rating_snapshots where competition_id in (1,2) and round_number = 5) <> 1 then
    raise exception 'Round 5 Power snapshot must use exactly one approved model version';
  end if;
  if exists (
    select 1
    from public.team_rating_snapshots trs
    left join public.league_matches lm on lm.id = trs.match_id
    where trs.competition_id in (1,2) and trs.round_number = 5
      and (trs.match_id is null or lm.competition_phase <> 'regular_season' or lm.competition_id <> trs.competition_id)
  ) then
    raise exception 'Final Power snapshot is not tied exclusively to Summer regular-season evidence';
  end if;

  select count(*) into expected_team_count
  from (
    select competition_id, format, team_name
    from (
      select competition_id, format, team_a as team_name from public.league_matches
      where id between 767 and 1168 and status = 'completed'
      union
      select competition_id, format, team_b as team_name from public.league_matches
      where id between 767 and 1168 and status = 'completed'
    ) teams
    where nullif(trim(team_name), '') is not null
  ) expected;

  select count(*) into snapshot_team_count
  from public.team_rating_snapshots
  where competition_id in (1,2) and round_number = 5;

  if snapshot_team_count <> expected_team_count then
    raise exception 'Round 5 Power coverage mismatch: expected %, found %', expected_team_count, snapshot_team_count;
  end if;
end $$;

create schema if not exists fr_release_backup;
create table if not exists fr_release_backup.summer_closeout_competitions_20260922 (
  competition_id bigint primary key,
  before_row jsonb not null,
  captured_at timestamptz not null default now()
);
create table if not exists fr_release_backup.summer_closeout_season_20260922 (
  season_id bigint primary key,
  before_row jsonb not null,
  captured_at timestamptz not null default now()
);

insert into fr_release_backup.summer_closeout_competitions_20260922 (competition_id, before_row)
select id, to_jsonb(c) from public.competitions c where id in (1,2)
on conflict (competition_id) do nothing;

insert into fr_release_backup.summer_closeout_season_20260922 (season_id, before_row)
select season_id, to_jsonb(s)
from public.competition_seasons s
where lower(trim(league_name)) = 'the rivalry'
  and lower(trim(season_name)) = 'summer circuit'
  and season_year = 2026
on conflict (season_id) do nothing;

do $$
begin
  if (select count(*) from fr_release_backup.summer_closeout_competitions_20260922) <> 2
     or (select count(*) from fr_release_backup.summer_closeout_season_20260922) <> 1 then
    raise exception 'Closeout before-image capture failed';
  end if;
end $$;

update public.competitions
set status = 'completed', current_stage = 'completed'
where id in (1,2)
  and status <> 'completed';

update public.competition_seasons
set status = 'completed', updated_at = now()
where lower(trim(league_name)) = 'the rivalry'
  and lower(trim(season_name)) = 'summer circuit'
  and season_year = 2026
  and status <> 'completed';

do $$
begin
  if (select count(*) from public.competitions where id in (1,2) and status = 'completed' and current_stage = 'completed') <> 2
     or (select count(*) from public.competition_seasons where lower(trim(league_name)) = 'the rivalry' and lower(trim(season_name)) = 'summer circuit' and season_year = 2026 and status = 'completed') <> 1 then
    raise exception 'Summer completion post-write validation failed';
  end if;
end $$;

commit;
