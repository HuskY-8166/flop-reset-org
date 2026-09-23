-- PREPARED ONLY. Exact rollback for competition IDs 1/2 and their Summer season.

begin;
set local lock_timeout = '5s';
lock table public.competitions in share row exclusive mode;
lock table public.competition_seasons in share row exclusive mode;

do $$
begin
  if to_regclass('fr_release_backup.summer_closeout_competitions_20260922') is null
     or to_regclass('fr_release_backup.summer_closeout_season_20260922') is null
     or (select count(*) from fr_release_backup.summer_closeout_competitions_20260922) <> 2
     or (select count(*) from fr_release_backup.summer_closeout_season_20260922) <> 1 then
    raise exception 'Closeout before-image is missing';
  end if;
end $$;

with before_values as (
  select (jsonb_populate_record(null::public.competitions, before_row)).*
  from fr_release_backup.summer_closeout_competitions_20260922
)
update public.competitions c
set status = b.status,
    current_stage = b.current_stage,
    season_id = b.season_id
from before_values b
where c.id = b.id and c.id in (1,2);

with before_values as (
  select (jsonb_populate_record(null::public.competition_seasons, before_row)).*
  from fr_release_backup.summer_closeout_season_20260922
)
update public.competition_seasons s
set status = b.status,
    updated_at = b.updated_at
from before_values b
where s.season_id = b.season_id;

commit;
