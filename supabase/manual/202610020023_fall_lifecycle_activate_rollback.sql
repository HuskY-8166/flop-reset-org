-- FLOP RESET V2.4 — FALL 2026 LIFECYCLE ACTIVATION ROLLBACK

begin;
set local lock_timeout = '5s';
lock table public.competitions in share row exclusive mode;
lock table public.competition_seasons in share row exclusive mode;

do $$
begin
  if to_regclass('fr_release_backup.fall_lifecycle_competitions_20261002') is null
     or to_regclass('fr_release_backup.fall_lifecycle_season_20261002') is null
     or (select count(*) from fr_release_backup.fall_lifecycle_competitions_20261002) <> 2
     or (select count(*) from fr_release_backup.fall_lifecycle_season_20261002) <> 1 then
    raise exception 'Fall lifecycle before-image is missing or ambiguous';
  end if;
end $$;

with before_values as (
  select (jsonb_populate_record(null::public.competitions, before_row)).*
  from fr_release_backup.fall_lifecycle_competitions_20261002
)
update public.competitions c
set status = b.status,
    current_stage = b.current_stage,
    season_id = b.season_id
from before_values b
where c.id = b.id and c.id in (3,4);

with before_values as (
  select (jsonb_populate_record(null::public.competition_seasons, before_row)).*
  from fr_release_backup.fall_lifecycle_season_20261002
)
update public.competition_seasons s
set status = b.status,
    updated_at = b.updated_at
from before_values b
where s.season_id = b.season_id and s.season_id = 2;

commit;
