-- PREPARED ONLY. Exact rollback for the 11 entry mappings.

begin;
set local lock_timeout = '5s';
lock table public.competition_entries in share row exclusive mode;

do $$
begin
  if to_regclass('fr_release_backup.summer_entry_identity_20260922') is null
     or (select count(*) from fr_release_backup.summer_entry_identity_20260922) <> 11 then
    raise exception 'Required 11-row entry identity before-image is missing';
  end if;
end $$;

update public.competition_entries e
set opponent_id = b.opponent_id,
    updated_at = coalesce((b.before_row ->> 'updated_at')::timestamptz, e.updated_at)
from fr_release_backup.summer_entry_identity_20260922 b
where e.entry_id = b.entry_id
  and e.entry_id in (124,127,130,132,135,137,143,149,150,156,157);

do $$
begin
  if exists (
    select 1 from public.competition_entries e
    join fr_release_backup.summer_entry_identity_20260922 b using (entry_id)
    where e.opponent_id is distinct from b.opponent_id
  ) then
    raise exception 'Entry identity rollback validation failed';
  end if;
end $$;

commit;
