-- PREPARED ONLY. Exact rollback for Option B.

begin;
set local lock_timeout = '5s';
lock table public.playoff_brackets in share row exclusive mode;
lock table public.playoff_matches in share row exclusive mode;

do $$
begin
  if to_regclass('fr_release_backup.blank_t4_bracket_20260922') is null
     or to_regclass('fr_release_backup.blank_t4_match_20260922') is null
     or (select count(*) from fr_release_backup.blank_t4_bracket_20260922) <> 1
     or (select count(*) from fr_release_backup.blank_t4_match_20260922) <> 1
     or exists (select 1 from public.playoff_brackets where bracket_id = 2)
     or exists (select 1 from public.playoff_matches where playoff_match_id = 22) then
    raise exception 'Option B rollback preflight failed';
  end if;
end $$;

insert into public.playoff_brackets
select (jsonb_populate_record(null::public.playoff_brackets, before_row)).*
from fr_release_backup.blank_t4_bracket_20260922;

insert into public.playoff_matches
select (jsonb_populate_record(null::public.playoff_matches, before_row)).*
from fr_release_backup.blank_t4_match_20260922;

do $$
begin
  if not exists (select 1 from public.playoff_brackets where bracket_id = 2)
     or not exists (select 1 from public.playoff_matches where playoff_match_id = 22 and bracket_id = 2) then
    raise exception 'Option B rollback validation failed';
  end if;
end $$;

commit;
