-- V2.4 PREPARED MANUAL DATA SCRIPT. REVIEW BEFORE RUNNING.
-- Stores only the playoff facts supplied in the approved V2.4 brief.
-- It does not create series, games, player stats, Power evidence, or guessed identities.
-- Unknown results remain NULL/TBD. Historical display names are preserved verbatim.

begin;

do $$
begin
  if not exists (
    select 1 from public.competitions
    where id = 2
      and league_name = 'The Rivalry'
      and circuit_name = 'Summer Circuit'
      and season_year = 2026
      and format = '3v3'
  ) then
    raise exception 'Verified Summer 2026 3v3 competition (id 2) was not found; seed aborted.';
  end if;

  if (select count(*) from public.playoff_brackets where competition_id = 2 and tier = '6') <> 1
     or not exists (
       select 1 from public.playoff_brackets
       where bracket_id = 1 and competition_id = 2 and tier = '6'
     ) then
    raise exception 'Verified Summer T6 bracket_id 1 was not found as the sole T6 bracket; seed aborted.';
  end if;

  if exists (
    select 1
    from public.playoff_brackets b
    join public.playoff_matches m on m.bracket_id = b.bracket_id
    where b.competition_id = 2 and b.tier in ('4', '5')
  ) then
    raise exception 'A Summer T4/T5 bracket already contains matches; reconcile it before seeding.';
  end if;

  if (select array_agg(playoff_match_id::bigint order by playoff_match_id)
      from public.playoff_matches where bracket_id = 1)
       is distinct from array[14,15,16,17,18,19,20,21]::bigint[] then
    raise exception 'T6 row set changed from reviewed scaffold IDs 14-21; seed aborted.';
  end if;

  if exists (
    select 1
    from public.playoff_matches
    where bracket_id = 1
      and (
        round_name is distinct from 'Opening Round'
        or round_order is distinct from 1
        or match_order not between 1 and 8
        or status is distinct from 'tbd'
        or slot1_team_id is not null or slot1_opponent_id is not null or slot1_name_snapshot is not null
        or slot2_team_id is not null or slot2_opponent_id is not null or slot2_name_snapshot is not null
        or team_a_name is not null or team_b_name is not null
        or flop_reset_team_a_id is not null or flop_reset_team_b_id is not null
        or opponent_a_id is not null or opponent_b_id is not null
        or competition_entry_a_id is not null or competition_entry_b_id is not null
        or slot1_score is not null or slot2_score is not null
        or score_a is not null or score_b is not null
        or winner_side is not null or winner_name is not null
        or coalesce(is_bye, false) or coalesce(is_forfeit, false)
        or series_id is not null or scheduled_match_id is not null or scheduled_at is not null
        or next_match_id is not null or next_slot is not null
        or loser_next_match_id is not null or loser_next_slot is not null
        or notes is not null
      )
  ) then
    raise exception 'Reviewed T6 scaffold IDs 14-21 are no longer blank opening-round rows; seed aborted.';
  end if;

  if (select count(distinct match_order) from public.playoff_matches where bracket_id = 1) <> 8 then
    raise exception 'Reviewed T6 scaffold does not contain match orders 1-8 exactly once; seed aborted.';
  end if;
end $$;

create temporary table v24_playoff_source (
  tier text not null,
  round_name text not null,
  round_order integer not null,
  match_order integer not null,
  team_a_name text,
  team_b_name text,
  score_a integer,
  score_b integer,
  winner_side integer,
  is_bye boolean not null default false,
  best_of integer,
  status text not null default 'tbd',
  notes text,
  -- Mirrors playoff_matches' live uniqueness rule so collisions fail here
  -- before any persistent bracket rows are inserted.
  primary key (tier, round_order, match_order)
) on commit drop;

insert into v24_playoff_source
  (tier, round_name, round_order, match_order, team_a_name, team_b_name, score_a, score_b, winner_side, is_bye, best_of, status, notes)
values
  -- Tier 6
  ('6','Opening Round',1,1,'Ohio Midlads',null,null,null,1,true,null,'final','Verified BYE; no competitive result.'),
  ('6','Opening Round',1,2,'SuperSonic DADS','EC United',null,null,null,false,7,'tbd','Source states EC United advances; score was not supplied, so result remains unresolved.'),
  ('6','Opening Round',1,3,'Phantom Pressure',null,null,null,1,true,null,'final','Verified BYE; no competitive result.'),
  ('6','Opening Round',1,4,'MwM | Golden Clouds',null,null,null,1,true,null,'final','Verified BYE; no competitive result.'),
  ('6','Opening Round',1,5,'Flop Reset Frameshift',null,null,null,1,true,null,'final','Verified BYE; no competitive result.'),
  ('6','Opening Round',1,6,'Fake Squad','SBC Blue Angels',4,0,1,false,7,'final','Verified supplied score.'),
  ('6','Opening Round',1,7,'Pigeon Boys',null,null,null,1,true,null,'final','Verified BYE; no competitive result.'),
  ('6','Opening Round',1,8,'Hypertension Gaming','The Burton Battlers',4,0,1,false,7,'final','Verified supplied score.'),
  ('6','Quarterfinal',2,1,'Ohio Midlads','EC United',null,null,null,false,7,'tbd',null),
  ('6','Quarterfinal',2,2,'Phantom Pressure','MwM | Golden Clouds',null,null,null,false,7,'tbd',null),
  ('6','Quarterfinal',2,3,'Flop Reset Frameshift','Fake Squad',null,null,null,false,7,'tbd',null),
  ('6','Quarterfinal',2,4,'Pigeon Boys','Hypertension Gaming',null,null,null,false,7,'tbd',null),
  ('6','Semifinal',3,1,null,null,null,null,null,false,7,'tbd',null),
  ('6','Semifinal',3,2,null,null,null,null,null,false,7,'tbd',null),
  ('6','Final',4,1,null,null,null,null,null,false,7,'tbd',null),
  ('6','3rd Place',4,2,null,null,null,null,null,false,7,'tbd',null),

  -- Tier 5
  ('5','Opening Round',1,1,'Spartan Ares',null,null,null,1,true,null,'final','Verified BYE; no competitive result.'),
  ('5','Opening Round',1,2,'Chanclas Agresivas','Spartan Guardians',4,3,1,false,7,'final','Verified supplied score.'),
  ('5','Opening Round',1,3,'The Bozo Collective','New Age Phantoms',2,4,2,false,7,'final','Verified supplied score.'),
  ('5','Opening Round',1,4,'Simplify Green','Event Horizon NES',0,4,2,false,7,'final','Verified supplied score.'),
  ('5','Opening Round',1,5,'Simplify Brown',null,null,null,1,true,null,'final','Verified BYE; no competitive result.'),
  ('5','Opening Round',1,6,'Four Mattsketeers','The Whiffing Wontons',4,3,1,false,7,'final','Verified supplied score.'),
  ('5','Opening Round',1,7,'Flop Reset - Frantic',null,null,null,1,true,null,'final','Verified BYE; no competitive result.'),
  ('5','Opening Round',1,8,'No Boost Specials','Gator Sports',3,4,2,false,7,'final','Verified supplied score.'),
  ('5','Quarterfinal',2,1,'Spartan Ares','Chanclas Agresivas',null,null,null,false,7,'tbd',null),
  ('5','Quarterfinal',2,2,'New Age Phantoms','Event Horizon NES',null,null,null,false,7,'tbd',null),
  ('5','Quarterfinal',2,3,'Simplify Brown','Four Mattsketeers',null,null,null,false,7,'tbd',null),
  ('5','Quarterfinal',2,4,'Flop Reset - Frantic','Gator Sports',null,null,null,false,7,'tbd',null),
  ('5','Semifinal',3,1,null,null,null,null,null,false,7,'tbd',null),
  ('5','Semifinal',3,2,null,null,null,null,null,false,7,'tbd',null),
  ('5','Final',4,1,null,null,null,null,null,false,7,'tbd',null),
  ('5','3rd Place',4,2,null,null,null,null,null,false,7,'tbd',null),

  -- Tier 4
  ('4','Opening Round',1,1,'Phantisms','Cosmic Esports',4,3,1,false,7,'final','Verified supplied score.'),
  ('4','Opening Round',1,2,'Spartan Trionda','Kung-Fu Treachery',3,4,2,false,7,'final','Verified supplied score.'),
  ('4','Opening Round',1,3,'Ronin','Phantom mobs',2,4,2,false,7,'final','Verified supplied score.'),
  ('4','Opening Round',1,4,'Silver Singles','Happy Little Plats',4,0,1,false,7,'final','Verified supplied score.'),
  ('4','Opening Round',1,5,'Phantom Whiffskateers','Eternal Ronin OG',3,4,2,false,7,'final','Verified supplied score.'),
  ('4','Opening Round',1,6,'Instinct','Phantom',3,4,2,false,7,'final','Verified supplied score.'),
  ('4','Opening Round',1,7,'SWORDFISH MEN','StormCore Vortex',4,3,1,false,7,'final','Verified supplied score.'),
  ('4','Opening Round',1,8,'Flop Reset | Fracture','NBDA Neon',4,0,1,false,7,'final','Verified supplied score.'),
  ('4','Quarterfinal',2,1,'Phantisms','Kung-Fu Treachery',null,null,null,false,7,'tbd',null),
  ('4','Quarterfinal',2,2,'Phantom mobs','Silver Singles',null,null,null,false,7,'tbd',null),
  ('4','Quarterfinal',2,3,'Eternal Ronin OG','Phantom',null,null,null,false,7,'tbd',null),
  ('4','Quarterfinal',2,4,'SWORDFISH MEN','Flop Reset | Fracture',4,2,1,false,7,'final','Verified supplied score.'),
  ('4','Semifinal',3,1,null,null,null,null,null,false,7,'tbd',null),
  ('4','Semifinal',3,2,null,'SWORDFISH MEN',null,null,null,false,7,'tbd',null),
  ('4','Final',4,1,null,null,null,null,null,false,7,'tbd',null),
  ('4','3rd Place',4,2,null,null,null,null,null,false,7,'tbd',null);

-- The three organization identities are explicit in the supplied source.
do $$
declare
  squad text;
begin
  foreach squad in array array['Fracture','Frantic','Frameshift'] loop
    if (select count(*) from public.teams where name = squad and format = '3v3') <> 1 then
      raise exception 'Expected exactly one 3v3 Flop Reset squad named %; seed aborted.', squad;
    end if;
  end loop;
end $$;

insert into public.playoff_brackets (competition_id, tier, name, status)
select 2, tier, 'The Rivalry - Summer Circuit 2026 - T' || tier || ' Bracket', 'active'
from (values ('4'),('5'),('6')) tiers(tier)
where not exists (
  select 1 from public.playoff_brackets b
  where b.competition_id = 2 and b.tier = tiers.tier
);

-- Known FR entries are linked; every external name remains an unresolved,
-- source-keyed competition entry rather than a guessed canonical opponent.
insert into public.competition_entries
  (competition_id, fr_team_id, source_registration_key, slug, display_name_snapshot, tier, registration_status, competitive_status, source_provider, notes)
select distinct
  2,
  t.id,
  'v24-summer-t' || s.tier || '-' || lower(t.name),
  'summer-2026-t' || s.tier || '-' || regexp_replace(lower(t.name), '[^a-z0-9]+', '-', 'g'),
  case t.name when 'Fracture' then 'Flop Reset | Fracture' when 'Frantic' then 'Flop Reset - Frantic' else 'Flop Reset Frameshift' end,
  s.tier,
  'registered',
  'active',
  'v24_verified_brief',
  'Canonical FR identity with source display snapshot.'
from v24_playoff_source s
join public.teams t on t.name = case
  when coalesce(s.team_a_name, s.team_b_name) like '%Fracture%' then 'Fracture'
  when coalesce(s.team_a_name, s.team_b_name) like '%Frantic%' then 'Frantic'
  when coalesce(s.team_a_name, s.team_b_name) like '%Frameshift%' then 'Frameshift'
end and t.format = '3v3'
where coalesce(s.team_a_name, s.team_b_name) like '%Flop Reset%'
on conflict (competition_id, fr_team_id) where fr_team_id is not null do update
set display_name_snapshot = excluded.display_name_snapshot,
    tier = excluded.tier,
    updated_at = now();

with participant_names as (
  select tier, team_a_name as display_name from v24_playoff_source where team_a_name is not null
  union
  select tier, team_b_name from v24_playoff_source where team_b_name is not null
), external_names as (
  select * from participant_names
  where display_name not like 'Flop Reset%'
)
insert into public.competition_entries
  (competition_id, source_registration_key, slug, display_name_snapshot, tier, registration_status, competitive_status, source_provider, source_values, notes)
select 2,
  'v24-summer-t' || tier || '-' || regexp_replace(lower(display_name), '[^a-z0-9]+', '-', 'g'),
  'summer-2026-t' || tier || '-' || trim(both '-' from regexp_replace(lower(display_name), '[^a-z0-9]+', '-', 'g')),
  display_name,
  tier,
  'registered',
  'active',
  'v24_verified_brief',
  jsonb_build_object('display_name', display_name, 'identity_status', 'unresolved'),
  'Historical playoff participant; canonical opponent identity intentionally unresolved.'
from external_names
on conflict (competition_id, source_provider, source_registration_key)
  where source_provider is not null and source_registration_key is not null
do update set display_name_snapshot = excluded.display_name_snapshot,
              tier = excluded.tier,
              updated_at = now();

-- Reuse the verified blank T6 opening-round scaffold in place. The guarded
-- update preserves playoff_match_id values 14-21 and therefore any references.
update public.playoff_matches m
set team_a_name = s.team_a_name,
    team_b_name = s.team_b_name,
    competition_entry_a_id = ea.entry_id,
    competition_entry_b_id = eb.entry_id,
    score_a = s.score_a,
    score_b = s.score_b,
    winner_side = s.winner_side,
    winner_name = case s.winner_side when 1 then s.team_a_name when 2 then s.team_b_name end,
    is_bye = s.is_bye,
    is_forfeit = false,
    best_of = s.best_of,
    status = s.status,
    notes = s.notes
from v24_playoff_source s
left join public.competition_entries ea
  on ea.competition_id = 2 and ea.tier = s.tier and ea.display_name_snapshot = s.team_a_name
left join public.competition_entries eb
  on eb.competition_id = 2 and eb.tier = s.tier and eb.display_name_snapshot = s.team_b_name
where m.bracket_id = 1
  and s.tier = '6'
  and s.round_name = 'Opening Round'
  and s.match_order = m.match_order;

insert into public.playoff_matches
  (bracket_id, round_name, round_order, match_order,
   team_a_name, team_b_name, competition_entry_a_id, competition_entry_b_id,
   score_a, score_b, winner_side, winner_name, is_bye, is_forfeit, best_of, status, notes)
select
  b.bracket_id, s.round_name, s.round_order, s.match_order,
  s.team_a_name, s.team_b_name,
  ea.entry_id, eb.entry_id,
  s.score_a, s.score_b, s.winner_side,
  case s.winner_side when 1 then s.team_a_name when 2 then s.team_b_name end,
  s.is_bye, false, s.best_of, s.status, s.notes
from v24_playoff_source s
join public.playoff_brackets b on b.competition_id = 2 and b.tier = s.tier
left join public.competition_entries ea on ea.competition_id = 2 and ea.tier = s.tier and ea.display_name_snapshot = s.team_a_name
left join public.competition_entries eb on eb.competition_id = 2 and eb.tier = s.tier and eb.display_name_snapshot = s.team_b_name
where not (s.tier = '6' and s.round_name = 'Opening Round');

-- Deterministic winner routes. No participant is advanced by this update;
-- supplied downstream snapshots remain source evidence, and future actions use Admin.
update public.playoff_matches source
set next_match_id = destination.playoff_match_id,
    next_slot = case when source.match_order % 2 = 1 then 1 else 2 end
from public.playoff_brackets b,
     public.playoff_matches destination
where source.bracket_id = b.bracket_id
  and destination.bracket_id = source.bracket_id
  and b.competition_id = 2 and b.tier in ('4','5','6')
  and source.round_name = 'Opening Round'
  and destination.round_name = 'Quarterfinal'
  and destination.match_order = ((source.match_order + 1) / 2);

update public.playoff_matches source
set next_match_id = destination.playoff_match_id,
    next_slot = case when source.match_order % 2 = 1 then 1 else 2 end
from public.playoff_brackets b,
     public.playoff_matches destination
where source.bracket_id = b.bracket_id
  and destination.bracket_id = source.bracket_id
  and b.competition_id = 2 and b.tier in ('4','5','6')
  and source.round_name = 'Quarterfinal'
  and destination.round_name = 'Semifinal'
  and destination.match_order = ((source.match_order + 1) / 2);

update public.playoff_matches source
set next_match_id = final.playoff_match_id,
    next_slot = source.match_order,
    loser_next_match_id = third_place.playoff_match_id,
    loser_next_slot = source.match_order
from public.playoff_brackets b,
     public.playoff_matches final,
     public.playoff_matches third_place
where source.bracket_id = b.bracket_id
  and final.bracket_id = source.bracket_id and final.round_name = 'Final'
  and third_place.bracket_id = source.bracket_id and third_place.round_name = '3rd Place'
  and b.competition_id = 2 and b.tier in ('4','5','6')
  and source.round_name = 'Semifinal';

-- Review output. The unresolved EC United opening-round score is intentional.
select b.tier, m.round_name, m.match_order, m.team_a_name, m.team_b_name,
       m.score_a, m.score_b, m.winner_side, m.is_bye, m.status,
       m.next_match_id, m.next_slot, m.loser_next_match_id, m.loser_next_slot, m.notes
from public.playoff_matches m
join public.playoff_brackets b on b.bracket_id = m.bracket_id
where b.competition_id = 2 and b.tier in ('4','5','6')
order by b.tier::integer, m.round_order, m.match_order, m.round_name;

select entry_id, tier, display_name_snapshot, fr_team_id, opponent_id, source_registration_key
from public.competition_entries
where competition_id = 2 and source_provider = 'v24_verified_brief'
order by tier::integer, display_name_snapshot;

commit;
