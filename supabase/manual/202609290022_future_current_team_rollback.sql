-- FLOP RESET V2.4 — FUTURE CURRENT TEAM IDENTITY ROLLBACK
-- Safe only before verified Future roster, competition, schedule, result,
-- playoff, or Power data exists. Historical Frantic rows are never changed.

begin;

do $$
declare
  future_id bigint;
begin
  select id into future_id
  from public.teams
  where name = 'Future'
    and format = '3v3';

  if future_id is null then
    raise exception 'Future 3v3 identity was not found; refusing rollback.';
  end if;

  if exists (select 1 from public.series where flop_reset_team_id = future_id)
     or exists (select 1 from public.matches where flop_reset_team_id = future_id)
     or exists (select 1 from public.players where team_id = future_id)
     or exists (select 1 from public.player_team_memberships where team_id = future_id)
     or exists (select 1 from public.competition_entries where fr_team_id = future_id)
     or exists (select 1 from public.scheduled_matches where flop_reset_team_id = future_id)
     or exists (
       select 1 from public.playoff_matches
       where flop_reset_team_a_id = future_id
          or flop_reset_team_b_id = future_id
     )
     or exists (
       select 1 from public.team_rating_snapshots
       where lower(team_name_snapshot) in ('future', 'flop reset future')
     ) then
    raise exception 'Future has linked data; rollback would destroy history and is blocked.';
  end if;

  delete from public.teams
  where id = future_id
    and name = 'Future'
    and format = '3v3';

  update public.teams
  set active = true
  where lower(name) = 'frantic'
    and format = '3v3';
end $$;

commit;

select id, name, format, active
from public.teams
where lower(name) in ('frantic', 'future')
order by id;
