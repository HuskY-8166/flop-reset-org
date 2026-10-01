-- FLOP RESET V2.4 — CORE SITE-ADMIN WRITE POLICY ROLLBACK
-- Restores the exact write-policy definitions captured by migration 018.

begin;
set local lock_timeout = '5s';

do $$
declare
  table_name text;
  policy_row record;
  role_list text;
  statement text;
begin
  if to_regclass('fr_release_backup.core_write_policies_20260930') is null then
    raise exception 'Core write-policy before-image is missing';
  end if;

  foreach table_name in array array[
    'competitions', 'teams', 'players', 'opponents', 'opponent_aliases',
    'series', 'matches', 'match_player_stats', 'league_matches',
    'scheduled_matches', 'playoff_brackets', 'playoff_matches',
    'player_team_memberships', 'seasons'
  ] loop
    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    loop
      execute format('drop policy %I on public.%I', policy_row.policyname, table_name);
    end loop;

    for policy_row in
      select *
      from fr_release_backup.core_write_policies_20260930
      where schemaname = 'public' and tablename = table_name
      order by policyname
    loop
      select string_agg(quote_ident(role_name::text), ', ')
        into role_list
      from unnest(policy_row.roles) role_name;

      statement := format(
        'create policy %I on public.%I as %s for %s to %s',
        policy_row.policyname,
        table_name,
        policy_row.permissive,
        policy_row.cmd,
        role_list
      );
      if policy_row.qual is not null and policy_row.cmd <> 'INSERT' then
        statement := statement || ' using (' || policy_row.qual || ')';
      end if;
      if policy_row.with_check is not null and policy_row.cmd in ('ALL', 'INSERT', 'UPDATE') then
        statement := statement || ' with check (' || policy_row.with_check || ')';
      end if;
      execute statement;
    end loop;
  end loop;
end $$;

commit;
