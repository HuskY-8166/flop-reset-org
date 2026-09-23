-- PREPARED ONLY. Exact rollback for Option A.

begin;
set local lock_timeout = '5s';
lock table public.playoff_brackets in share row exclusive mode;

do $$
begin
  if to_regclass('fr_release_backup.blank_t4_hide_20260922') is null
     or (select count(*) from fr_release_backup.blank_t4_hide_20260922) <> 1
     or not exists (select 1 from public.playoff_brackets where bracket_id = 2 and status = 'hidden') then
    raise exception 'Option A before-image or applied state is missing';
  end if;
end $$;

update public.playoff_brackets pb
set status = b.before_row ->> 'status'
from fr_release_backup.blank_t4_hide_20260922 b
where pb.bracket_id = b.bracket_id and pb.bracket_id = 2;

commit;
