-- FLOP RESET V2.4 — CORE SITE-ADMIN WRITE POLICY COMPATIBILITY
--
-- Replace only legacy authenticated-wide write policies on core Admin tables.
-- Public read policies and all competitive rows remain unchanged.

begin;
set local lock_timeout = '5s';

create schema if not exists fr_release_backup;
create table if not exists fr_release_backup.core_write_policies_20260930 (
  schemaname name not null,
  tablename name not null,
  policyname name not null,
  permissive text not null,
  roles name[] not null,
  cmd text not null,
  qual text,
  with_check text,
  captured_at timestamptz not null default now(),
  primary key (schemaname, tablename, policyname)
);

do $$
declare
  table_name text;
  policy_row record;
begin
  foreach table_name in array array[
    'competitions', 'teams', 'players', 'opponents', 'opponent_aliases',
    'series', 'matches', 'match_player_stats', 'league_matches',
    'scheduled_matches', 'playoff_brackets', 'playoff_matches',
    'player_team_memberships', 'seasons'
  ] loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Required Admin table public.% is missing', table_name;
    end if;

    insert into fr_release_backup.core_write_policies_20260930 (
      schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    )
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename = table_name
      and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    on conflict (schemaname, tablename, policyname) do nothing;

    execute format('alter table public.%I enable row level security', table_name);

    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    loop
      execute format('drop policy %I on public.%I', policy_row.policyname, table_name);
    end loop;

    execute format(
      'create policy %I on public.%I for all to authenticated using (coalesce((auth.jwt() -> ''app_metadata'' ->> ''site_admin'')::boolean, false)) with check (coalesce((auth.jwt() -> ''app_metadata'' ->> ''site_admin'')::boolean, false))',
      table_name || '_admin_write', table_name
    );
  end loop;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'competitions', 'teams', 'players', 'opponents', 'opponent_aliases',
        'series', 'matches', 'match_player_stats', 'league_matches',
        'scheduled_matches', 'playoff_brackets', 'playoff_matches',
        'player_team_memberships', 'seasons'
      ])
      and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      and (coalesce(qual, '') || coalesce(with_check, '')) not ilike '%site_admin%'
  ) then
    raise exception 'Authenticated-wide core write policy remains after hardening';
  end if;

  if (
    select count(distinct tablename)
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'competitions', 'teams', 'players', 'opponents', 'opponent_aliases',
        'series', 'matches', 'match_player_stats', 'league_matches',
        'scheduled_matches', 'playoff_brackets', 'playoff_matches',
        'player_team_memberships', 'seasons'
      ])
      and cmd = 'ALL'
      and (coalesce(qual, '') || coalesce(with_check, '')) ilike '%site_admin%'
  ) <> 14 then
    raise exception 'Not every core Admin table has a site-admin write policy';
  end if;
end $$;

commit;
