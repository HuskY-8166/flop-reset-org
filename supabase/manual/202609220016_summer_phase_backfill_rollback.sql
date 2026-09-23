-- PREPARED ONLY. Exact rollback for 202609220016_summer_phase_backfill.sql.

begin;

set local lock_timeout = '5s';
lock table public.series in share row exclusive mode;
lock table public.league_matches in share row exclusive mode;

do $$
begin
  if to_regclass('fr_release_backup.summer_phase_series_20260922') is null
     or to_regclass('fr_release_backup.summer_phase_league_matches_20260922') is null then
    raise exception 'Required before-image tables are missing';
  end if;
  if (select count(*) from fr_release_backup.summer_phase_series_20260922) <> 15
     or (select count(*) from fr_release_backup.summer_phase_league_matches_20260922) <> 402 then
    raise exception 'Before-image counts are not 15/402';
  end if;
  if (select count(*) from public.series where series_id between 32 and 46 and competition_phase = 'regular_season') <> 15
     or (select count(*) from public.league_matches where id between 767 and 1168 and competition_phase = 'regular_season') <> 402 then
    raise exception 'Target rows no longer match the expected applied state';
  end if;
end $$;

update public.series s
set competition_phase = b.competition_phase
from fr_release_backup.summer_phase_series_20260922 b
where s.series_id = b.series_id
  and s.series_id between 32 and 46;

update public.league_matches lm
set competition_phase = b.competition_phase
from fr_release_backup.summer_phase_league_matches_20260922 b
where lm.id = b.league_match_id
  and lm.id between 767 and 1168;

do $$
begin
  if exists (
    select 1
    from public.series s
    join fr_release_backup.summer_phase_series_20260922 b using (series_id)
    where s.competition_phase is distinct from b.competition_phase
  ) or exists (
    select 1
    from public.league_matches lm
    join fr_release_backup.summer_phase_league_matches_20260922 b on b.league_match_id = lm.id
    where lm.competition_phase is distinct from b.competition_phase
  ) then
    raise exception 'Rollback validation failed';
  end if;
end $$;

commit;
