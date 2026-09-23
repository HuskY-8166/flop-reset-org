-- PREPARED ONLY. DO NOT CREATE STATISTICAL SERIES FROM BRACKET RESULTS.
-- Source evidence: The Rivalry Summer Circuit 2026 bracket, fetched read-only
-- on 2026-09-22. Uses the service-role-only atomic sync RPC from migration 014.

begin;

set local lock_timeout = '5s';
lock table public.playoff_matches in share row exclusive mode;

do $$
begin
  if to_regprocedure('public.apply_rivalry_playoff_sync(jsonb)') is null then
    raise exception 'Migration 014 is required before playoff reconciliation';
  end if;

  -- Existing verified Fracture rows are protected by exact assertions and are
  -- not part of the update list.
  if not exists (
    select 1 from public.playoff_matches
    where playoff_match_id = 46 and bracket_id = 9
      and team_a_name = 'Flop Reset | Fracture' and team_b_name = 'NBDA Neon'
      and competition_entry_a_id = 121 and competition_entry_b_id = 125
      and score_a = 4 and score_b = 0 and winner_side = 1
      and winner_name = 'Flop Reset | Fracture' and status = 'final'
  ) or not exists (
    select 1 from public.playoff_matches
    where playoff_match_id = 50 and bracket_id = 9
      and team_a_name = 'SWORDFISH MEN' and team_b_name = 'Flop Reset | Fracture'
      and competition_entry_a_id = 155 and competition_entry_b_id = 121
      and score_a = 4 and score_b = 2 and winner_side = 1
      and winner_name = 'SWORDFISH MEN' and status = 'final'
  ) then
    raise exception 'Verified Fracture rows changed; stop before reconciling anything';
  end if;

  if (select count(*) from public.playoff_matches where playoff_match_id in (66,68,70,73)) <> 4 then
    raise exception 'Expected playoff match IDs 66, 68, 70, 73';
  end if;
  if exists (
    select 1 from public.playoff_matches
    where playoff_match_id in (66,68,70,73)
      and (status <> 'tbd' or score_a is not null or score_b is not null
        or winner_side is not null or winner_name is not null
        or is_bye or is_forfeit or series_id is not null or scheduled_match_id is not null)
  ) then
    raise exception 'A target playoff row no longer matches the reviewed unresolved state';
  end if;
end $$;

create schema if not exists fr_release_backup;
create table if not exists fr_release_backup.summer_playoff_results_20260922 (
  playoff_match_id bigint primary key,
  before_row jsonb not null,
  captured_at timestamptz not null default now()
);

insert into fr_release_backup.summer_playoff_results_20260922 (playoff_match_id, before_row)
select playoff_match_id, to_jsonb(pm)
from public.playoff_matches pm
where playoff_match_id in (66,68,70,73)
on conflict (playoff_match_id) do nothing;

do $$
begin
  if (select count(*) from fr_release_backup.summer_playoff_results_20260922) <> 4 then
    raise exception 'Playoff before-image count is not 4';
  end if;
end $$;

select *
from public.apply_rivalry_playoff_sync(
  '[
    {
      "playoff_match_id": 66,
      "expected_status": "tbd",
      "expected": {
        "team_a_name": "Flop Reset - Frantic",
        "team_b_name": "Gator Sports",
        "competition_entry_a_id": 122,
        "competition_entry_b_id": 135,
        "score_a": null,
        "score_b": null,
        "winner_side": null,
        "is_bye": false,
        "is_forfeit": false
      },
      "patch": {
        "score_a": 4,
        "score_b": 2,
        "winner_side": 1,
        "winner_name": "Flop Reset - Frantic",
        "status": "final"
      }
    },
    {
      "playoff_match_id": 68,
      "expected_status": "tbd",
      "expected": {
        "team_a_name": null,
        "team_b_name": null,
        "competition_entry_a_id": null,
        "competition_entry_b_id": null,
        "score_a": null,
        "score_b": null,
        "winner_side": null,
        "is_bye": false,
        "is_forfeit": false
      },
      "patch": {
        "team_a_name": "Four Mattsketeers",
        "team_b_name": "Flop Reset - Frantic",
        "competition_entry_a_id": 158,
        "competition_entry_b_id": 122,
        "score_a": 4,
        "score_b": 1,
        "winner_side": 1,
        "winner_name": "Four Mattsketeers",
        "status": "final"
      }
    },
    {
      "playoff_match_id": 70,
      "expected_status": "tbd",
      "expected": {
        "team_a_name": null,
        "team_b_name": null,
        "competition_entry_a_id": null,
        "competition_entry_b_id": null,
        "score_a": null,
        "score_b": null,
        "winner_side": null,
        "is_bye": false,
        "is_forfeit": false
      },
      "patch": {
        "team_a_name": "New Age Phantoms",
        "team_b_name": "Flop Reset - Frantic",
        "competition_entry_a_id": 136,
        "competition_entry_b_id": 122,
        "status": "tbd"
      }
    },
    {
      "playoff_match_id": 73,
      "expected_status": "tbd",
      "expected": {
        "team_a_name": "Flop Reset Frameshift",
        "team_b_name": "Fake Squad",
        "competition_entry_a_id": 123,
        "competition_entry_b_id": 150,
        "score_a": null,
        "score_b": null,
        "winner_side": null,
        "is_bye": false,
        "is_forfeit": false
      },
      "patch": {
        "score_a": 3,
        "score_b": 4,
        "winner_side": 2,
        "winner_name": "Fake Squad",
        "status": "final"
      }
    }
  ]'::jsonb
);

do $$
begin
  if not exists (select 1 from public.playoff_matches where playoff_match_id = 66 and score_a = 4 and score_b = 2 and winner_side = 1 and status = 'final')
     or not exists (select 1 from public.playoff_matches where playoff_match_id = 68 and competition_entry_a_id = 158 and competition_entry_b_id = 122 and score_a = 4 and score_b = 1 and winner_side = 1 and status = 'final')
     or not exists (select 1 from public.playoff_matches where playoff_match_id = 70 and competition_entry_a_id = 136 and competition_entry_b_id = 122 and score_a is null and score_b is null and winner_side is null and status = 'tbd')
     or not exists (select 1 from public.playoff_matches where playoff_match_id = 73 and score_a = 3 and score_b = 4 and winner_side = 2 and status = 'final') then
    raise exception 'Playoff post-write validation failed';
  end if;

  if exists (
    select 1 from public.playoff_matches
    where playoff_match_id in (66,68,70,73)
      and (series_id is not null or scheduled_match_id is not null or is_bye or is_forfeit)
  ) then
    raise exception 'Reconciliation created a statistical/schedule/forfeit link unexpectedly';
  end if;
end $$;

commit;

select playoff_match_id, bracket_id, round_name, team_a_name, team_b_name,
       score_a, score_b, winner_side, winner_name, status, series_id
from public.playoff_matches
where playoff_match_id in (46,50,66,68,70,73)
order by playoff_match_id;
