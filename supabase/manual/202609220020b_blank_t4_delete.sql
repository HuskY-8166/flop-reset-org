-- PREPARED OPTION B. NOT RECOMMENDED UNTIL THE 2v2 BRACKET'S PURPOSE IS
-- RESOLVED. Deletes only blank match 22 and bracket 2 after exact guards.

begin;
set local lock_timeout = '5s';
lock table public.playoff_brackets in share row exclusive mode;
lock table public.playoff_matches in share row exclusive mode;

do $$
begin
  if not exists (
    select 1 from public.playoff_brackets
    where bracket_id = 2 and competition_id = 1 and tier = '4'
      and name = 'Rivalry Summer Circuit Tier 4 Bracket' and status = 'active'
  ) then
    raise exception 'Bracket 2 no longer matches the reviewed container';
  end if;
  if (select count(*) from public.playoff_matches where bracket_id = 2) <> 1
     or not exists (
       select 1 from public.playoff_matches
       where playoff_match_id = 22 and bracket_id = 2
         and team_a_name is null and team_b_name is null
         and competition_entry_a_id is null and competition_entry_b_id is null
         and score_a is null and score_b is null and winner_side is null
         and status = 'tbd' and not is_bye and not is_forfeit
         and series_id is null and scheduled_match_id is null
         and next_match_id is null and loser_next_match_id is null and notes is null
     ) then
    raise exception 'Bracket 2 is no longer the reviewed one-row blank structure';
  end if;
  if exists (
    select 1 from public.playoff_matches
    where playoff_match_id <> 22
      and (next_match_id = 22 or loser_next_match_id = 22)
  ) then
    raise exception 'Another bracket route points to match 22';
  end if;
end $$;

create schema if not exists fr_release_backup;
create table if not exists fr_release_backup.blank_t4_bracket_20260922 (
  bracket_id bigint primary key,
  before_row jsonb not null,
  captured_at timestamptz not null default now()
);
create table if not exists fr_release_backup.blank_t4_match_20260922 (
  playoff_match_id bigint primary key,
  before_row jsonb not null,
  captured_at timestamptz not null default now()
);

insert into fr_release_backup.blank_t4_bracket_20260922 (bracket_id, before_row)
select bracket_id, to_jsonb(pb) from public.playoff_brackets pb where bracket_id = 2
on conflict (bracket_id) do nothing;
insert into fr_release_backup.blank_t4_match_20260922 (playoff_match_id, before_row)
select playoff_match_id, to_jsonb(pm) from public.playoff_matches pm where playoff_match_id = 22
on conflict (playoff_match_id) do nothing;

do $$
begin
  if (select count(*) from fr_release_backup.blank_t4_bracket_20260922) <> 1
     or (select count(*) from fr_release_backup.blank_t4_match_20260922) <> 1 then
    raise exception 'Blank T4 before-image capture failed';
  end if;
end $$;

delete from public.playoff_matches where playoff_match_id = 22 and bracket_id = 2;
delete from public.playoff_brackets where bracket_id = 2 and competition_id = 1;

do $$
begin
  if exists (select 1 from public.playoff_matches where playoff_match_id = 22)
     or exists (select 1 from public.playoff_brackets where bracket_id = 2) then
    raise exception 'Blank T4 delete validation failed';
  end if;
end $$;

commit;
