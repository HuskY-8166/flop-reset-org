-- MANUAL SECURITY REVIEW: DO NOT RUN UNTIL THE CURRENT ADMIN JWT IS CONFIRMED
-- TO CONTAIN app_metadata.site_admin = true.
--
-- This changes policies only. It does not alter or delete competitive data.

begin;

-- Review this result before continuing. Any authenticated-wide write policy is
-- too broad for future fan/community accounts.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'competitions', 'teams', 'players', 'opponents', 'opponent_aliases',
    'series', 'matches', 'match_player_stats', 'league_matches',
    'scheduled_matches', 'playoff_brackets', 'playoff_matches',
    'competition_sources', 'external_team_sources', 'competition_entries',
    'league_players', 'competition_roster_members', 'external_source_snapshots',
    'identity_reconciliation_queue', 'admin_audit_log', 'page_content_overrides'
  )
order by tablename, cmd, policyname;

do $$
declare
  table_name text;
  policy record;
begin
  foreach table_name in array array[
    'competitions', 'teams', 'players', 'opponents', 'opponent_aliases',
    'series', 'matches', 'match_player_stats', 'league_matches',
    'scheduled_matches', 'playoff_brackets', 'playoff_matches',
    'competition_sources', 'external_team_sources', 'competition_entries',
    'league_players', 'competition_roster_members', 'external_source_snapshots',
    'identity_reconciliation_queue', 'admin_audit_log', 'page_content_overrides'
  ] loop
    if to_regclass('public.' || table_name) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);

    for policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    loop
      execute format('drop policy %I on public.%I', policy.policyname, table_name);
    end loop;

    execute format(
      'create policy %I on public.%I for all to authenticated using (coalesce((auth.jwt() -> ''app_metadata'' ->> ''site_admin'')::boolean, false)) with check (coalesce((auth.jwt() -> ''app_metadata'' ->> ''site_admin'')::boolean, false))',
      table_name || '_site_admin_write',
      table_name
    );
  end loop;
end $$;

commit;

-- Post-review: every write policy returned here must require site_admin.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
order by tablename, policyname;
