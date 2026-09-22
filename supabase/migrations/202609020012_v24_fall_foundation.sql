-- FLOP RESET V2.4 — FALL CIRCUIT FOUNDATION
-- Schema-only and non-destructive. This migration does not seed brackets,
-- reset competitive history, or guess the phase of historical series.

begin;

alter table public.series add column if not exists competition_phase text;
alter table public.series alter column competition_phase set default 'regular_season';
alter table public.league_matches add column if not exists competition_phase text;
alter table public.league_matches alter column competition_phase set default 'regular_season';
alter table public.competitions add column if not exists current_stage text;
alter table public.competitions alter column current_stage set default 'upcoming';

alter table public.teams add column if not exists display_name text;
alter table public.teams add column if not exists short_name text;
alter table public.teams add column if not exists slug text;
alter table public.teams add column if not exists primary_color text;
alter table public.teams add column if not exists secondary_color text;
alter table public.teams add column if not exists logo_url text;
alter table public.teams add column if not exists wordmark_style text not null default 'default';
alter table public.teams add column if not exists active boolean not null default true;
alter table public.teams add column if not exists brand_metadata jsonb not null default '{}'::jsonb;

update public.teams
set display_name = coalesce(display_name, name),
    short_name = coalesce(short_name, name),
    slug = coalesce(slug, trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))),
    primary_color = coalesce(primary_color, '#FF00A6'),
    secondary_color = coalesce(
      secondary_color,
      case lower(name)
        when 'fracture' then '#C042D7'
        when 'frantic' then '#CAFF00'
        when 'frameshift' then '#42A3D7'
        else '#42D7C0'
      end
    )
where display_name is null
   or short_name is null
   or slug is null
   or primary_color is null
   or secondary_color is null;

-- A squad can retain separate format registrations in the legacy teams table,
-- so the shared brand slug is indexed but intentionally not unique here.
create index if not exists teams_slug_idx on public.teams(slug) where slug is not null;
create index if not exists series_competition_phase_idx
  on public.series(competition_id, competition_phase, series_date);
create index if not exists league_matches_competition_phase_idx
  on public.league_matches(competition_id, format, competition_phase, match_date);
create unique index if not exists playoff_matches_series_unique
  on public.playoff_matches(series_id) where series_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.series'::regclass and conname = 'series_competition_phase_valid') then
    alter table public.series add constraint series_competition_phase_valid
      check (competition_phase is null or competition_phase in ('regular_season','playoffs','qualifier','scrim','exhibition')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.league_matches'::regclass and conname = 'league_matches_competition_phase_valid') then
    alter table public.league_matches add constraint league_matches_competition_phase_valid
      check (competition_phase is null or competition_phase in ('regular_season','playoffs','qualifier','scrim','exhibition')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.competitions'::regclass and conname = 'competitions_current_stage_valid') then
    alter table public.competitions add constraint competitions_current_stage_valid
      check (current_stage is null or current_stage in ('upcoming','regular_season','playoffs','completed')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.playoff_matches'::regclass and conname = 'playoff_winner_side_integer_valid') then
    alter table public.playoff_matches add constraint playoff_winner_side_integer_valid
      check (winner_side is null or winner_side in (1,2)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.playoff_matches'::regclass and conname = 'playoff_bye_exact_participant') then
    alter table public.playoff_matches add constraint playoff_bye_exact_participant check (
      not coalesce(is_bye,false) or (
        num_nonnulls(flop_reset_team_a_id, opponent_a_id, competition_entry_a_id)
        + num_nonnulls(flop_reset_team_b_id, opponent_b_id, competition_entry_b_id) = 1
        and score_a is null and score_b is null and best_of is null
        and series_id is null and scheduled_match_id is null
        and not coalesce(is_forfeit,false) and winner_side in (1,2)
      )
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.playoff_matches'::regclass and conname = 'playoff_forfeit_two_participants') then
    alter table public.playoff_matches add constraint playoff_forfeit_two_participants check (
      not coalesce(is_forfeit,false) or (
        num_nonnulls(flop_reset_team_a_id, opponent_a_id, competition_entry_a_id) = 1
        and num_nonnulls(flop_reset_team_b_id, opponent_b_id, competition_entry_b_id) = 1
        and score_a is null and score_b is null and not coalesce(is_bye,false)
        and winner_side in (1,2)
      )
    ) not valid;
  end if;
end $$;

create or replace view public.v24_phase_reconciliation
with (security_barrier = true)
as
select
  s.series_id,
  s.competition_id,
  s.flop_reset_team_id,
  s.opponent_id,
  s.opponent_name,
  s.series_date,
  s.notes
from public.series s
where s.competition_phase is null
  and coalesce((auth.jwt() -> 'app_metadata' ->> 'site_admin')::boolean, false);

revoke all on public.v24_phase_reconciliation from anon;
grant select on public.v24_phase_reconciliation to authenticated;

comment on column public.series.competition_phase is
  'Competition context inherited by games and player stats. Historical NULL values require explicit reconciliation; never guess.';
comment on column public.league_matches.competition_phase is
  'Power evidence stage. BYEs never create rows; forfeits create zero rating movement.';
comment on view public.v24_phase_reconciliation is
  'Admin-only queue of historical series whose phase has not been verified.';

commit;
