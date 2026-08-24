-- PREPARED ONLY: validate current authentication and service-role workflows
-- before applying. Public tables are read-only to anonymous visitors; writes
-- require an authenticated user whose JWT includes app_metadata.site_admin.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'competitions', 'teams', 'players', 'series', 'matches',
    'match_player_stats', 'league_matches'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select using (true)',
      table_name || '_public_read', table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''site_admin'')::boolean is true) with check ((auth.jwt() -> ''app_metadata'' ->> ''site_admin'')::boolean is true)',
      table_name || '_admin_write', table_name
    );
  end loop;
end $$;

