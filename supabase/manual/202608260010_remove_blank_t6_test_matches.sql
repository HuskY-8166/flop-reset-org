-- MANUAL, GUARDED CLEANUP ONLY.
-- Reviewed target: bracket 1, The Rivalry - Summer Circuit 2026 - T6 Bracket.
-- Preserves the bracket container and refuses to delete any row that has
-- acquired participants, scores, results, links, routing, scheduling, or notes.

begin;

do $$
declare
  target_ids bigint[];
begin
  if not exists (
    select 1
    from public.playoff_brackets
    where bracket_id = 1
      and competition_id = 2
      and tier = '6'
      and name = 'The Rivalry - Summer Circuit 2026 - T6 Bracket'
  ) then
    raise exception 'Verified T6 bracket container does not match; cleanup aborted.';
  end if;

  select array_agg(playoff_match_id::bigint order by playoff_match_id)
  into target_ids
  from public.playoff_matches
  where bracket_id = 1;

  if target_ids is distinct from array[3,4,5,6,7,8,9,10,11,12]::bigint[] then
    raise exception 'T6 playoff row set changed from reviewed IDs 3-12; cleanup aborted.';
  end if;

  if exists (
    select 1
    from public.playoff_matches pm
    join (
      values
        (3::bigint, 'Quarterfinal'::text, 2, 1, null::integer),
        (4::bigint, 'Quarterfinal'::text, 2, 2, null::integer),
        (5::bigint, 'Semifinal'::text, 3, 1, null::integer),
        (6::bigint, 'Opening Round'::text, 1, 1, 7::integer),
        (7::bigint, 'Opening Round'::text, 1, 2, 7::integer),
        (8::bigint, 'Opening Round'::text, 1, 3, 7::integer),
        (9::bigint, 'Opening Round'::text, 1, 4, 7::integer),
        (10::bigint, 'Opening Round'::text, 1, 5, 7::integer),
        (11::bigint, 'Opening Round'::text, 1, 6, 7::integer),
        (12::bigint, 'Opening Round'::text, 1, 7, 7::integer)
    ) expected(playoff_match_id, round_name, round_order, match_order, best_of)
      on expected.playoff_match_id = pm.playoff_match_id
    where pm.bracket_id = 1
      and (
        pm.round_name is distinct from expected.round_name
        or pm.round_order is distinct from expected.round_order
        or pm.match_order is distinct from expected.match_order
        or pm.best_of is distinct from expected.best_of
      )
  ) then
    raise exception 'T6 round, order, or best-of structure changed; cleanup aborted.';
  end if;

  if exists (
    select 1
    from public.playoff_matches
    where bracket_id = 1
      and (
        status is distinct from 'tbd'
        or slot1_team_id is not null
        or slot1_opponent_id is not null
        or slot1_name_snapshot is not null
        or slot2_team_id is not null
        or slot2_opponent_id is not null
        or slot2_name_snapshot is not null
        or team_a_name is not null
        or team_b_name is not null
        or flop_reset_team_a_id is not null
        or flop_reset_team_b_id is not null
        or opponent_a_id is not null
        or opponent_b_id is not null
        or slot1_score is not null
        or slot2_score is not null
        or score_a is not null
        or score_b is not null
        or winner_side is not null
        or winner_name is not null
        or coalesce(is_bye, false)
        or coalesce(is_forfeit, false)
        or series_id is not null
        or scheduled_match_id is not null
        or scheduled_at is not null
        or next_match_id is not null
        or next_slot is not null
        or loser_next_match_id is not null
        or loser_next_slot is not null
        or notes is not null
      )
  ) then
    raise exception 'A T6 playoff row now contains meaningful production data; cleanup aborted.';
  end if;

  if exists (
    select 1
    from public.playoff_matches
    where bracket_id <> 1
      and (
        next_match_id = any(target_ids)
        or loser_next_match_id = any(target_ids)
      )
  ) then
    raise exception 'Another bracket routes into the reviewed T6 rows; cleanup aborted.';
  end if;
end $$;

-- Pre-delete proof: these are the only rows this script is allowed to remove.
select
  playoff_match_id,
  bracket_id,
  round_name,
  round_order,
  match_order,
  best_of,
  status,
  created_at
from public.playoff_matches
where bracket_id = 1
order by playoff_match_id;

delete from public.playoff_matches
where bracket_id = 1
  and playoff_match_id = any(array[3,4,5,6,7,8,9,10,11,12]::bigint[])
  and status = 'tbd'
  and slot1_team_id is null
  and slot1_opponent_id is null
  and slot1_name_snapshot is null
  and slot2_team_id is null
  and slot2_opponent_id is null
  and slot2_name_snapshot is null
  and team_a_name is null
  and team_b_name is null
  and flop_reset_team_a_id is null
  and flop_reset_team_b_id is null
  and opponent_a_id is null
  and opponent_b_id is null
  and slot1_score is null
  and slot2_score is null
  and score_a is null
  and score_b is null
  and winner_side is null
  and winner_name is null
  and not coalesce(is_bye, false)
  and not coalesce(is_forfeit, false)
  and series_id is null
  and scheduled_match_id is null
  and scheduled_at is null
  and next_match_id is null
  and next_slot is null
  and loser_next_match_id is null
  and loser_next_slot is null
  and notes is null
returning playoff_match_id, bracket_id, round_name, round_order, match_order;

do $$
begin
  if (select count(*) from public.playoff_matches where bracket_id = 1) <> 0 then
    raise exception 'Not all reviewed blank T6 rows were removed; transaction rolled back.';
  end if;

  if not exists (
    select 1
    from public.playoff_brackets
    where bracket_id = 1
      and name = 'The Rivalry - Summer Circuit 2026 - T6 Bracket'
  ) then
    raise exception 'T6 bracket container was not preserved; transaction rolled back.';
  end if;
end $$;

commit;
