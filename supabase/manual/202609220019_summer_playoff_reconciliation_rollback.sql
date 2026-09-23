-- PREPARED ONLY. Exact rollback for playoff matches 66, 68, 70, and 73.

begin;
set local lock_timeout = '5s';
lock table public.playoff_matches in share row exclusive mode;

do $$
begin
  if to_regclass('fr_release_backup.summer_playoff_results_20260922') is null
     or (select count(*) from fr_release_backup.summer_playoff_results_20260922) <> 4 then
    raise exception 'Required four-row playoff before-image is missing';
  end if;
end $$;

with before_values as (
  select (jsonb_populate_record(null::public.playoff_matches, before_row)).*
  from fr_release_backup.summer_playoff_results_20260922
)
update public.playoff_matches pm
set team_a_name = b.team_a_name,
    team_b_name = b.team_b_name,
    competition_entry_a_id = b.competition_entry_a_id,
    competition_entry_b_id = b.competition_entry_b_id,
    score_a = b.score_a,
    score_b = b.score_b,
    winner_side = b.winner_side,
    winner_name = b.winner_name,
    status = b.status,
    best_of = b.best_of,
    is_bye = b.is_bye,
    is_forfeit = b.is_forfeit,
    series_id = b.series_id,
    scheduled_match_id = b.scheduled_match_id,
    notes = b.notes,
    updated_at = b.updated_at
from before_values b
where pm.playoff_match_id = b.playoff_match_id
  and pm.playoff_match_id in (66,68,70,73);

do $$
begin
  if exists (
    select 1
    from public.playoff_matches pm
    join fr_release_backup.summer_playoff_results_20260922 b using (playoff_match_id)
    where to_jsonb(pm) is distinct from b.before_row
  ) then
    raise exception 'Playoff rollback validation failed';
  end if;
end $$;

commit;
