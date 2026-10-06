-- STAGING ONLY — exact cleanup for the synthetic Fall opening-series rehearsal.

begin;
set local lock_timeout = '5s';

delete from public.team_rating_snapshots where competition_id = -8800;
delete from public.league_matches where competition_id = -8800;
delete from public.match_player_stats where match_id in (select match_id from public.matches where competition_id = -8800);
delete from public.matches where competition_id = -8800;
delete from public.series where competition_id = -8800;
delete from public.competition_roster_members where roster_member_id in (-8801,-8802,-8803) and entry_id = -8800;
delete from public.competition_entries where entry_id = -8800 and competition_id = -8800;
delete from public.league_players where league_player_id in (-8801,-8802,-8803) and linked_fr_player_id in (-8801,-8802,-8803);
delete from public.players where player_id in (-8801,-8802,-8803) and team_id = -8800;
delete from public.opponents where opponent_id = -8800 and normalized_name = 'qa orbit';
delete from public.teams where id = -8800 and name = 'QA Fall Comets';
delete from public.competitions where id = -8800 and name = 'QA Fall 2026 | 3v3';
delete from public.competition_seasons where season_id = -8800 and slug = 'qa-fall-rehearsal-2026';

do $$
begin
  if exists (select 1 from public.competitions where id = -8800)
     or exists (select 1 from public.teams where id = -8800)
     or exists (select 1 from public.players where player_id in (-8801,-8802,-8803))
     or exists (select 1 from public.series where competition_id = -8800)
     or exists (select 1 from public.matches where competition_id = -8800)
     or exists (select 1 from public.league_matches where competition_id = -8800)
     or exists (select 1 from public.team_rating_snapshots where competition_id = -8800) then
    raise exception 'Synthetic rehearsal cleanup is incomplete';
  end if;
end $$;

commit;
