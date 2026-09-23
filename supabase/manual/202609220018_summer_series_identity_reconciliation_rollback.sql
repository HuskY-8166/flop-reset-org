-- PREPARED ONLY. Exact rollback for series 32-41 and 43-46.

begin;
set local lock_timeout = '5s';
lock table public.series in share row exclusive mode;

do $$
begin
  if to_regclass('fr_release_backup.summer_series_identity_20260922') is null
     or (select count(*) from fr_release_backup.summer_series_identity_20260922) <> 14 then
    raise exception 'Required 14-row series identity before-image is missing';
  end if;
end $$;

update public.series s
set opponent_id = b.opponent_id
from fr_release_backup.summer_series_identity_20260922 b
where s.series_id = b.series_id
  and s.series_id in (32,33,34,35,36,37,38,39,40,41,43,44,45,46);

do $$
begin
  if exists (
    select 1 from public.series s
    join fr_release_backup.summer_series_identity_20260922 b using (series_id)
    where s.opponent_id is distinct from b.opponent_id
  ) then
    raise exception 'Series identity rollback validation failed';
  end if;
end $$;

commit;
