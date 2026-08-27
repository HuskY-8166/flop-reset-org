-- FLOP RESET V2.3.8 — MANUAL EXECUTION ONLY
-- Reviewed reset for a clean Summer 2026 rebuild.
--
-- BEFORE RUNNING:
-- 1. Export public.series, public.matches, public.match_player_stats,
--    public.league_matches, public.scheduled_matches, public.playoff_brackets,
--    public.playoff_matches, and public.team_rating_snapshots (when present).
-- 2. Confirm the Admin Data Health view says READY FOR CONTROLLED RESET.
-- 3. Run this complete file once in the Supabase SQL editor.
--
-- This script does not use TRUNCATE or CASCADE. It preserves competitions,
-- teams, players, aliases, opponents, schedules, brackets, and authentication.

begin;

-- Required structural tables. Abort before any destructive statement when the
-- live schema differs from the reviewed scope.
do $$
declare
  required_table text;
begin
  foreach required_table in array array[
    'public.competitions',
    'public.teams',
    'public.players',
    'public.opponents',
    'public.opponent_aliases',
    'public.series',
    'public.matches',
    'public.match_player_stats',
    'public.league_matches',
    'public.scheduled_matches',
    'public.playoff_brackets',
    'public.playoff_matches'
  ] loop
    if to_regclass(required_table) is null then
      raise exception 'Required table % is missing; reset aborted.', required_table;
    end if;
  end loop;

  if (select count(*) from public.competitions where format = '3v3') = 0 then
    raise exception 'No 3v3 competition exists; reset aborted.';
  end if;

  if (select count(*) from public.teams) = 0
    or (select count(*) from public.players) = 0 then
    raise exception 'Team/player identity structure is empty; reset aborted.';
  end if;

  if exists (
    select 1
    from public.series s
    join public.competitions c on c.id = s.competition_id
    join public.teams t on t.id = s.flop_reset_team_id
    where c.format is distinct from t.format
  ) then
    raise exception 'Competition/team format mismatch remains; reset aborted.';
  end if;

  if not exists (
    select 1 from public.players where name = 'aktionrl' and 'AkTION' = any(coalesce(aliases, '{}'::text[]))
  ) or not exists (
    select 1 from public.players where name = 'droll' and 'Drollotov' = any(coalesce(aliases, '{}'::text[]))
  ) or not exists (
    select 1 from public.players where name = 'HuskY' and 'HuskY.G2' = any(coalesce(aliases, '{}'::text[]))
  ) then
    raise exception 'Verified Ballchasing player aliases are incomplete; reset aborted.';
  end if;

  if not exists (
    select 1
    from public.opponents o
    join public.opponent_aliases a on a.opponent_id = o.opponent_id
    where o.normalized_name = 'ohio midlads' and a.normalized_alias = 'midlads'
  ) or not exists (
    select 1
    from public.opponents o
    join public.opponent_aliases a on a.opponent_id = o.opponent_id
    where o.normalized_name = 'sbc blue angels' and a.normalized_alias = 'sbc angels'
  ) then
    raise exception 'Canonical opponent identities are incomplete; reset aborted.';
  end if;
end $$;

-- Zero-game administrative forfeits are series outcomes, never fake games.
alter table public.series add column if not exists is_forfeit boolean not null default false;
alter table public.series add column if not exists result_override text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.series'::regclass
      and conname = 'series_forfeit_result_valid'
  ) then
    alter table public.series
      add constraint series_forfeit_result_valid
      check (
        (is_forfeit is true and result_override in ('win', 'loss'))
        or (is_forfeit is false and result_override is null)
      ) not valid;
  end if;
end $$;

comment on column public.series.is_forfeit is
  'Administrative series result. A forfeit has zero matches and zero player-stat rows.';
comment on column public.series.result_override is
  'Flop Reset-perspective result for a zero-game forfeit: win or loss.';

-- First-class Playoffs Admin fields. Bracket rows/topology remain preserved.
alter table public.playoff_matches add column if not exists team_a_name text;
alter table public.playoff_matches add column if not exists team_b_name text;
alter table public.playoff_matches add column if not exists score_a integer;
alter table public.playoff_matches add column if not exists score_b integer;
alter table public.playoff_matches add column if not exists winner_name text;
alter table public.playoff_matches add column if not exists best_of integer;
alter table public.playoff_matches add column if not exists is_forfeit boolean not null default false;
alter table public.playoff_matches add column if not exists flop_reset_team_a_id bigint references public.teams(id);
alter table public.playoff_matches add column if not exists flop_reset_team_b_id bigint references public.teams(id);
alter table public.playoff_matches add column if not exists opponent_a_id bigint references public.opponents(opponent_id);
alter table public.playoff_matches add column if not exists opponent_b_id bigint references public.opponents(opponent_id);

create index if not exists playoff_matches_bracket_round_idx
  on public.playoff_matches(bracket_id, round_name, match_order);
create index if not exists playoff_matches_series_id_idx on public.playoff_matches(series_id);
create index if not exists playoff_matches_scheduled_match_id_idx on public.playoff_matches(scheduled_match_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.playoff_matches'::regclass and conname = 'playoff_matches_scores_nonnegative') then
    alter table public.playoff_matches add constraint playoff_matches_scores_nonnegative
      check ((score_a is null or score_a >= 0) and (score_b is null or score_b >= 0)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.playoff_matches'::regclass and conname = 'playoff_matches_best_of_positive_odd') then
    alter table public.playoff_matches add constraint playoff_matches_best_of_positive_odd
      check (best_of is null or (best_of > 0 and best_of % 2 = 1)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.playoff_matches'::regclass and conname = 'playoff_participant_identity_exclusive') then
    alter table public.playoff_matches add constraint playoff_participant_identity_exclusive
      check (
        not (flop_reset_team_a_id is not null and opponent_a_id is not null)
        and not (flop_reset_team_b_id is not null and opponent_b_id is not null)
      ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.playoff_matches'::regclass and conname = 'playoff_bye_has_no_competitive_result') then
    alter table public.playoff_matches add constraint playoff_bye_has_no_competitive_result
      check (
        coalesce(is_bye, false) is false
        or (
          series_id is null and scheduled_match_id is null
          and score_a is null and score_b is null
          and coalesce(is_forfeit, false) is false
        )
      ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.playoff_matches'::regclass and conname = 'playoff_bye_is_not_forfeit') then
    alter table public.playoff_matches add constraint playoff_bye_is_not_forfeit
      check (coalesce(is_bye, false) is false or coalesce(is_forfeit, false) is false) not valid;
  end if;
end $$;

alter table public.playoff_matches enable row level security;
alter table public.playoff_brackets enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'playoff_matches' and policyname = 'playoff_matches_public_read') then
    create policy playoff_matches_public_read on public.playoff_matches for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'playoff_matches' and policyname = 'playoff_matches_admin_write') then
    create policy playoff_matches_admin_write on public.playoff_matches for all to authenticated
      using ((auth.jwt() -> 'app_metadata' ->> 'site_admin')::boolean is true)
      with check ((auth.jwt() -> 'app_metadata' ->> 'site_admin')::boolean is true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'playoff_brackets' and policyname = 'playoff_brackets_public_read') then
    create policy playoff_brackets_public_read on public.playoff_brackets for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'playoff_brackets' and policyname = 'playoff_brackets_admin_write') then
    create policy playoff_brackets_admin_write on public.playoff_brackets for all to authenticated
      using ((auth.jwt() -> 'app_metadata' ->> 'site_admin')::boolean is true)
      with check ((auth.jwt() -> 'app_metadata' ->> 'site_admin')::boolean is true);
  end if;
end $$;

create unique index if not exists matches_replay_id_unique
  on public.matches(replay_id)
  where replay_id is not null;

-- An existing backup schema means this script was already attempted or run.
-- Refuse to overwrite it.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'fr_rebuild_backup_20260825') then
    raise exception 'Backup schema fr_rebuild_backup_20260825 already exists; reset aborted.';
  end if;
end $$;

create schema fr_rebuild_backup_20260825;
create table fr_rebuild_backup_20260825.series as table public.series;
create table fr_rebuild_backup_20260825.matches as table public.matches;
create table fr_rebuild_backup_20260825.match_player_stats as table public.match_player_stats;
create table fr_rebuild_backup_20260825.league_matches as table public.league_matches;
create table fr_rebuild_backup_20260825.scheduled_matches as table public.scheduled_matches;
create table fr_rebuild_backup_20260825.playoff_brackets as table public.playoff_brackets;
create table fr_rebuild_backup_20260825.playoff_matches as table public.playoff_matches;

do $$
begin
  if to_regclass('public.team_rating_snapshots') is not null then
    execute 'create table fr_rebuild_backup_20260825.team_rating_snapshots as table public.team_rating_snapshots';
  end if;
end $$;

-- Save the exact live foreign-key graph (including ON DELETE action) and block
-- any unreviewed table that points into the reset scope.
create table fr_rebuild_backup_20260825.foreign_key_graph as
select
  con.conname as constraint_name,
  format('%I.%I', source_ns.nspname, source.relname) as source_table,
  source_col.attname as source_column,
  format('%I.%I', target_ns.nspname, target.relname) as target_table,
  target_col.attname as target_column,
  case con.confdeltype
    when 'a' then 'NO ACTION'
    when 'r' then 'RESTRICT'
    when 'c' then 'CASCADE'
    when 'n' then 'SET NULL'
    when 'd' then 'SET DEFAULT'
  end as on_delete
from pg_constraint con
join pg_class source on source.oid = con.conrelid
join pg_namespace source_ns on source_ns.oid = source.relnamespace
join pg_class target on target.oid = con.confrelid
join pg_namespace target_ns on target_ns.oid = target.relnamespace
join lateral unnest(con.conkey, con.confkey) with ordinality keys(source_attnum, target_attnum, ord) on true
join pg_attribute source_col on source_col.attrelid = source.oid and source_col.attnum = keys.source_attnum
join pg_attribute target_col on target_col.attrelid = target.oid and target_col.attnum = keys.target_attnum
where con.contype = 'f'
  and format('%I.%I', target_ns.nspname, target.relname) in (
    'public.series', 'public.matches', 'public.match_player_stats', 'public.league_matches'
  );

do $$
begin
  if exists (
    select 1
    from fr_rebuild_backup_20260825.foreign_key_graph
    where not (
      (source_table = 'public.matches' and target_table = 'public.series')
      or (source_table = 'public.playoff_matches' and target_table = 'public.series')
      or (source_table = 'public.match_player_stats' and target_table = 'public.matches')
      or (source_table = 'public.team_rating_snapshots' and target_table = 'public.league_matches')
    )
  ) then
    raise exception 'An unidentified foreign key points into the reset scope; inspect backup foreign_key_graph.';
  end if;
end $$;

create table fr_rebuild_backup_20260825.pre_reset_manifest as
select
  now() as captured_at,
  (select count(*) from public.series) as series_count,
  (select count(*) from public.matches) as matches_count,
  (select count(*) from public.match_player_stats) as player_stat_count,
  (select count(*) from public.league_matches) as league_match_count,
  (select count(*) from public.matches where coalesce(is_forfeit, false)) as legacy_forfeit_game_rows,
  (select count(*) from public.matches where not coalesce(is_forfeit, false)) as non_forfeit_match_rows,
  (select count(*) from public.matches where series_id is not null and not coalesce(is_forfeit, false)) as official_played_game_rows,
  (select count(*) from public.matches where series_id is null) as matches_without_series,
  (select count(*) from public.matches where replay_id is not null) as replay_rows,
  (select min(match_date) from public.matches where not coalesce(is_forfeit, false)) as earliest_played_date,
  (select max(match_date) from public.matches where not coalesce(is_forfeit, false)) as latest_played_date;

-- V2.3.9 structural directory tables are outside the competitive reset scope.
-- Capture their row counts when the schema has been applied so the transaction
-- can prove that source, identity, roster, page, and audit history survived.
create table fr_rebuild_backup_20260825.v239_structural_manifest (
  table_name text primary key,
  row_count bigint not null
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'competition_sources',
    'external_team_sources',
    'competition_entries',
    'league_players',
    'competition_roster_members',
    'external_source_snapshots',
    'identity_reconciliation_queue',
    'admin_audit_log',
    'page_content_overrides'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format(
        'insert into fr_rebuild_backup_20260825.v239_structural_manifest(table_name, row_count) select %L, count(*) from public.%I',
        table_name,
        table_name
      );
    end if;
  end loop;
end $$;

-- Detach only playoff results sourced from FR series being rebuilt. Preserve
-- bracket topology and any external-vs-external result with no series link.
do $$
declare
  assignments text[] := array['series_id = null'];
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'playoff_matches' and column_name = 'score_a') then
    assignments := array_append(assignments, 'score_a = null');
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'playoff_matches' and column_name = 'score_b') then
    assignments := array_append(assignments, 'score_b = null');
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'playoff_matches' and column_name = 'slot1_score') then
    assignments := array_append(assignments, 'slot1_score = null');
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'playoff_matches' and column_name = 'slot2_score') then
    assignments := array_append(assignments, 'slot2_score = null');
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'playoff_matches' and column_name = 'winner_name') then
    assignments := array_append(assignments, 'winner_name = null');
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'playoff_matches' and column_name = 'winner_side') then
    assignments := array_append(assignments, 'winner_side = null');
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'playoff_matches' and column_name = 'is_forfeit') then
    assignments := array_append(assignments, 'is_forfeit = false');
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'playoff_matches' and column_name = 'status') then
    assignments := array_append(assignments, $sql$status = case when status = 'completed' then 'pending' else status end$sql$);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'playoff_matches' and column_name = 'notes') then
    assignments := array_append(assignments, $sql$notes = concat_ws(' · ', nullif(notes, ''), 'FR source series cleared for V2.3.8 rebuild')$sql$);
  end if;

  execute format(
    'update public.playoff_matches set %s where series_id in (select series_id from public.series)',
    array_to_string(assignments, ', ')
  );
end $$;

-- Explicit child-to-parent deletion order. No cascade command is used.
delete from public.match_player_stats;
delete from public.matches;
delete from public.series;

do $$
begin
  if to_regclass('public.team_rating_snapshots') is not null then
    execute 'delete from public.team_rating_snapshots';
  end if;
end $$;

delete from public.league_matches;

-- Transactional verification. Any failure rolls back deletes and backups.
do $$
declare
  manifest record;
  current_count bigint;
begin
  if (select count(*) from public.series) <> 0
    or (select count(*) from public.matches) <> 0
    or (select count(*) from public.match_player_stats) <> 0
    or (select count(*) from public.league_matches) <> 0 then
    raise exception 'Competitive reset verification failed; transaction rolled back.';
  end if;

  if (select count(*) from public.competitions) = 0
    or (select count(*) from public.teams) = 0
    or (select count(*) from public.players) = 0
    or (select count(*) from public.opponents) = 0 then
    raise exception 'Structural identity verification failed; transaction rolled back.';
  end if;

  if exists (select 1 from public.playoff_matches where series_id is not null) then
    raise exception 'A stale playoff series link remains; transaction rolled back.';
  end if;

  for manifest in select * from fr_rebuild_backup_20260825.v239_structural_manifest loop
    execute format('select count(*) from public.%I', manifest.table_name) into current_count;
    if current_count <> manifest.row_count then
      raise exception 'V2.3.9 structural table % changed during competitive reset; transaction rolled back.', manifest.table_name;
    end if;
  end loop;
end $$;

commit;

-- Post-reset proof returned to the SQL editor.
select 'series' as dataset, count(*)::bigint as remaining_rows from public.series
union all select 'matches', count(*)::bigint from public.matches
union all select 'match_player_stats', count(*)::bigint from public.match_player_stats
union all select 'league_matches', count(*)::bigint from public.league_matches
union all select 'competitions_preserved', count(*)::bigint from public.competitions
union all select 'teams_preserved', count(*)::bigint from public.teams
union all select 'players_preserved', count(*)::bigint from public.players
union all select 'opponents_preserved', count(*)::bigint from public.opponents
union all select 'scheduled_matches_preserved', count(*)::bigint from public.scheduled_matches
union all select 'playoff_brackets_preserved', count(*)::bigint from public.playoff_brackets;
