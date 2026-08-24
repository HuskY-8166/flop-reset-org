-- PREPARED ONLY. Do not apply until COMPETITION_DATA_AUDIT_2026-08-24.md
-- has been reviewed and the 14 existing mismatched series are corrected.

alter table public.competitions add column if not exists league_name text;
alter table public.competitions add column if not exists circuit_name text;
alter table public.competitions add column if not exists season_year integer;
alter table public.competitions add column if not exists status text;
alter table public.competitions add column if not exists start_date date;
alter table public.competitions add column if not exists end_date date;
alter table public.competitions add column if not exists region text;
alter table public.competitions add column if not exists timezone text;

-- Power-ranking imports predate competition ownership. Existing rows remain
-- nullable until their Summer Circuit source is confirmed and backfilled.
alter table public.league_matches add column if not exists competition_id bigint references public.competitions(id);
create index if not exists league_matches_competition_id_idx on public.league_matches(competition_id);

alter table public.competitions
  add constraint competitions_status_valid
  check (status is null or status in ('completed', 'active', 'upcoming')) not valid;

create or replace function public.enforce_competition_team_format()
returns trigger
language plpgsql
as $$
declare
  competition_format text;
  team_format text;
begin
  select format into competition_format from public.competitions where id = new.competition_id;
  select format into team_format from public.teams where id = new.flop_reset_team_id;

  if competition_format is null then raise exception 'Competition % does not exist.', new.competition_id; end if;
  if team_format is null then raise exception 'Team % does not exist.', new.flop_reset_team_id; end if;
  if competition_format <> team_format then
    raise exception 'Team format % cannot be entered into a % competition.', team_format, competition_format;
  end if;
  return new;
end;
$$;

-- These ordinary triggers protect every future writer, including scripts and
-- old Admin clients. Existing rows are intentionally left untouched.
drop trigger if exists series_competition_team_format on public.series;
create trigger series_competition_team_format
before insert or update of competition_id, flop_reset_team_id on public.series
for each row execute function public.enforce_competition_team_format();

drop trigger if exists matches_competition_team_format on public.matches;
create trigger matches_competition_team_format
before insert or update of competition_id, flop_reset_team_id on public.matches
for each row execute function public.enforce_competition_team_format();

drop trigger if exists scheduled_matches_competition_team_format on public.scheduled_matches;
create trigger scheduled_matches_competition_team_format
before insert or update of competition_id, flop_reset_team_id on public.scheduled_matches
for each row execute function public.enforce_competition_team_format();

create or replace function public.enforce_league_match_competition_format()
returns trigger
language plpgsql
as $$
declare
  competition_format text;
begin
  if new.competition_id is null then
    raise exception 'Power-ranking imports require a competition.';
  end if;

  select format into competition_format from public.competitions where id = new.competition_id;
  if competition_format is null then raise exception 'Competition % does not exist.', new.competition_id; end if;
  if competition_format <> new.format then
    raise exception 'A % ranking row cannot be entered into a % competition.', new.format, competition_format;
  end if;
  return new;
end;
$$;

-- Install this trigger only after the Admin power-ranking importer has shipped
-- its required competition selector and existing rows have been backfilled.
-- create trigger league_matches_competition_format
-- before insert or update of competition_id, format on public.league_matches
-- for each row execute function public.enforce_league_match_competition_format();

-- Recommended metadata after the row correction is approved:
-- update public.competitions set league_name='The Rivalry', circuit_name='Summer Circuit', season_year=2026
-- where id in (1, 2);
-- Do not create Fall Circuit by overwriting either row. Insert new 3v3 and 2v2
-- competition rows with circuit_name='Fall Circuit' and fresh standings.
-- Backfill league_matches.competition_id to the confirmed Summer 3v3/2v2 row,
-- then enable league_matches_competition_format before accepting Fall imports.
