-- Exact-ID rollback for 202610060027_publish_fall_round1_schedule.sql.
-- Refuses to remove any fixture already linked to competitive history.

begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('fr_release_backup.fall_round1_entry_tiers_20261006') is null
     or to_regclass('fr_release_backup.fall_round1_opponents_20261006') is null
     or to_regclass('fr_release_backup.fall_round1_fixtures_20261006') is null then
    raise exception 'Required Round 1 before-image is missing';
  end if;
  if exists (
    select 1 from public.series s
    join fr_release_backup.fall_round1_fixtures_20261006 b on b.scheduled_id = s.scheduled_match_id
  ) then
    raise exception 'Rollback blocked: at least one published fixture is linked to a result';
  end if;
end $$;

delete from public.scheduled_matches s
using fr_release_backup.fall_round1_fixtures_20261006 b
where s.scheduled_id = b.scheduled_id;

update public.competition_entries e
set tier = b.before_tier, updated_at = now()
from fr_release_backup.fall_round1_entry_tiers_20261006 b
where e.entry_id = b.entry_id;

delete from public.opponent_aliases a
using fr_release_backup.fall_round1_opponents_20261006 b
where b.created_alias_id is not null and a.alias_id = b.created_alias_id;

delete from public.opponents o
using fr_release_backup.fall_round1_opponents_20261006 b
where b.created_opponent and o.opponent_id = b.opponent_id
  and not exists (select 1 from public.series where opponent_id = o.opponent_id)
  and not exists (select 1 from public.matches where opponent_id = o.opponent_id)
  and not exists (select 1 from public.scheduled_matches where opponent_id = o.opponent_id)
  and not exists (select 1 from public.competition_entries where opponent_id = o.opponent_id)
  and not exists (select 1 from public.opponent_aliases where opponent_id = o.opponent_id);

do $$
begin
  if exists (select 1 from public.scheduled_matches s join fr_release_backup.fall_round1_fixtures_20261006 b using (scheduled_id)) then
    raise exception 'Fixture rollback validation failed';
  end if;
end $$;

commit;
