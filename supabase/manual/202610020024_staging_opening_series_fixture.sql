-- STAGING ONLY — synthetic Fall opening-series rehearsal foundation.
-- Never run on production. All identifiers are negative for exact cleanup.

begin;
set local lock_timeout = '5s';

do $$
begin
  if exists (select 1 from public.competitions where id = -8800 or name = 'QA Fall 2026 | 3v3')
     or exists (select 1 from public.teams where id = -8800 or name = 'QA Fall Comets')
     or exists (select 1 from public.opponents where opponent_id = -8800 or normalized_name = 'qa orbit') then
    raise exception 'Synthetic opening-series fixture already exists';
  end if;
end $$;

insert into public.competition_seasons (season_id, league_name, season_name, season_year, slug, status)
values (-8800, 'QA Rivalry', 'Fall Rehearsal', 2026, 'qa-fall-rehearsal-2026', 'upcoming');

insert into public.competitions (id, name, host, format, external_url, league_name, circuit_name, season_year, region, status, current_stage, season_id, start_date, end_date)
values (-8800, 'QA Fall 2026 | 3v3', 'QA Rivalry', '3v3', 'https://example.com/qa-fall', 'QA Rivalry', 'Fall Rehearsal', 2026, 'US-East', 'upcoming', 'upcoming', -8800, '2026-10-05', '2026-12-21');

insert into public.teams (id, name, format, captain, active, display_name, short_name, slug, primary_color, secondary_color)
values (-8800, 'QA Fall Comets', '3v3', 'Comet One', true, 'QA Fall Comets', 'Comets', 'qa-fall-comets', '#171717', '#AF69EE');

insert into public.players (player_id, name, team_id, aliases, status) values
  (-8801, 'Comet One', -8800, '{}', 'active'),
  (-8802, 'Comet Two', -8800, '{}', 'active'),
  (-8803, 'Comet Three', -8800, '{}', 'active');

insert into public.opponents (opponent_id, canonical_name, normalized_name, display_name, status)
values (-8800, 'QA Orbit', 'qa orbit', 'QA Orbit', 'active');

insert into public.competition_entries (entry_id, competition_id, fr_team_id, slug, display_name_snapshot, registration_status, competitive_status, is_power_tracked, status)
values (-8800, -8800, -8800, 'qa-fall-comets-3v3', 'QA Fall Comets', 'registered', 'active', true, 'active');

insert into public.league_players (league_player_id, slug, canonical_name, normalized_name, display_name, linked_fr_player_id, status) values
  (-8801, 'qa-comet-one', 'Comet One', 'comet one', 'Comet One', -8801, 'active'),
  (-8802, 'qa-comet-two', 'Comet Two', 'comet two', 'Comet Two', -8802, 'active'),
  (-8803, 'qa-comet-three', 'Comet Three', 'comet three', 'Comet Three', -8803, 'active');

insert into public.competition_roster_members (roster_member_id, entry_id, league_player_id, source_member_key, display_name_snapshot, role, status, is_current, source_provider) values
  (-8801, -8800, -8801, 'qa-comet-one', 'Comet One', 'captain', 'active', true, 'manual'),
  (-8802, -8800, -8802, 'qa-comet-two', 'Comet Two', 'player', 'active', true, 'manual'),
  (-8803, -8800, -8803, 'qa-comet-three', 'Comet Three', 'player', 'active', true, 'manual');

commit;
