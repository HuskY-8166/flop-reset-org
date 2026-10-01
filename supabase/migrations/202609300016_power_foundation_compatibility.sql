-- FLOP RESET V2.4 — PRODUCTION POWER FOUNDATION COMPATIBILITY
--
-- Add only the migration-005 objects that may be absent from an older live
-- database. This migration never calculates ratings, backfills snapshots, or
-- mutates competitive/history rows. An existing same-name object must match
-- the migration-005 contract or the transaction aborts.

begin;
set local lock_timeout = '5s';

do $$
declare
  expected record;
  actual record;
  existing_definition text;
begin
  if to_regclass('public.competitions') is null
     or to_regclass('public.league_matches') is null
     or to_regclass('public.opponents') is null then
    raise exception 'Power compatibility prerequisites are missing';
  end if;

  for expected in
    select * from (values
      ('competition_id', 'bigint'),
      ('source_name', 'text'),
      ('source_match_id', 'text'),
      ('team_a_opponent_id', 'bigint'),
      ('team_b_opponent_id', 'bigint')
    ) values_(column_name, data_type)
  loop
    select c.data_type, c.is_nullable
      into actual
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'league_matches'
      and c.column_name = expected.column_name;

    if found and (actual.data_type <> expected.data_type or actual.is_nullable <> 'YES') then
      raise exception 'Incompatible league_matches.%: expected nullable %, found % nullable=%',
        expected.column_name, expected.data_type, actual.data_type, actual.is_nullable;
    end if;
  end loop;

  if to_regclass('public.team_rating_snapshots') is not null then
    if (
      select count(*)
      from information_schema.columns
      where table_schema = 'public' and table_name = 'team_rating_snapshots'
    ) <> 15 then
      raise exception 'Existing team_rating_snapshots has an unexpected column count';
    end if;

    for expected in
      select * from (values
        ('snapshot_id', 'bigint', 'NO', 'YES'),
        ('competition_id', 'bigint', 'NO', 'NO'),
        ('format', 'text', 'NO', 'NO'),
        ('team_name_snapshot', 'text', 'NO', 'NO'),
        ('opponent_id', 'bigint', 'YES', 'NO'),
        ('round_label', 'text', 'NO', 'NO'),
        ('round_number', 'integer', 'NO', 'NO'),
        ('match_id', 'bigint', 'YES', 'NO'),
        ('snapshot_date', 'date', 'YES', 'NO'),
        ('rating', 'numeric', 'NO', 'NO'),
        ('overall_rank', 'integer', 'YES', 'NO'),
        ('tier_rank', 'integer', 'YES', 'NO'),
        ('rating_delta', 'numeric', 'NO', 'NO'),
        ('model_version', 'text', 'NO', 'NO'),
        ('created_at', 'timestamp with time zone', 'NO', 'NO')
      ) values_(column_name, data_type, is_nullable, is_identity)
    loop
      select c.data_type, c.is_nullable, c.is_identity, c.identity_generation
        into actual
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'team_rating_snapshots'
        and c.column_name = expected.column_name;

      if not found
         or actual.data_type <> expected.data_type
         or actual.is_nullable <> expected.is_nullable
         or actual.is_identity <> expected.is_identity
         or (expected.is_identity = 'YES' and actual.identity_generation <> 'BY DEFAULT') then
        raise exception 'Existing team_rating_snapshots.% is incompatible', expected.column_name;
      end if;
    end loop;

    if coalesce((
      select column_default in ('0', '0::numeric')
      from information_schema.columns
      where table_schema = 'public' and table_name = 'team_rating_snapshots'
        and column_name = 'rating_delta'
    ), false) is false then
      raise exception 'Existing team_rating_snapshots.rating_delta default is incompatible';
    end if;

    if coalesce((
      select column_default = 'now()'
      from information_schema.columns
      where table_schema = 'public' and table_name = 'team_rating_snapshots'
        and column_name = 'created_at'
    ), false) is false then
      raise exception 'Existing team_rating_snapshots.created_at default is incompatible';
    end if;

    for expected in
      select * from (values
        ('team_rating_snapshots_pkey', 'PRIMARY KEY (snapshot_id)'),
        ('team_rating_snapshots_competition_id_fkey', 'FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE'),
        ('team_rating_snapshots_opponent_id_fkey', 'FOREIGN KEY (opponent_id) REFERENCES opponents(opponent_id)'),
        ('team_rating_snapshots_match_id_fkey', 'FOREIGN KEY (match_id) REFERENCES league_matches(id) ON DELETE CASCADE'),
        ('team_rating_snapshots_competition_id_format_team_name_snaps_key', 'UNIQUE (competition_id, format, team_name_snapshot, round_number, match_id, model_version)'),
        ('team_rating_snapshots_format_valid', 'CHECK ((format = ANY (ARRAY[''2v2''::text, ''3v3''::text]))) NOT VALID')
      ) values_(constraint_name, definition)
    loop
      select pg_get_constraintdef(c.oid) as definition
        into actual
      from pg_constraint c
      where c.conrelid = 'public.team_rating_snapshots'::regclass
        and c.conname = expected.constraint_name;

      if not found or actual.definition <> expected.definition then
        raise exception 'Existing constraint % is missing or incompatible', expected.constraint_name;
      end if;
    end loop;
  end if;

  select indexdef into existing_definition
  from pg_indexes
  where schemaname = 'public' and indexname = 'league_matches_source_match_unique';
  if found and existing_definition <> 'CREATE UNIQUE INDEX league_matches_source_match_unique ON public.league_matches USING btree (competition_id, format, source_name, source_match_id) WHERE (source_match_id IS NOT NULL)' then
    raise exception 'Existing league_matches_source_match_unique is incompatible';
  end if;

  select indexdef into existing_definition
  from pg_indexes
  where schemaname = 'public' and indexname = 'team_rating_snapshots_pool_round_idx';
  if found and existing_definition <> 'CREATE INDEX team_rating_snapshots_pool_round_idx ON public.team_rating_snapshots USING btree (competition_id, format, round_number)' then
    raise exception 'Existing team_rating_snapshots_pool_round_idx is incompatible';
  end if;

  select indexdef into existing_definition
  from pg_indexes
  where schemaname = 'public' and indexname = 'team_rating_snapshots_team_idx';
  if found and existing_definition <> 'CREATE INDEX team_rating_snapshots_team_idx ON public.team_rating_snapshots USING btree (team_name_snapshot, competition_id, format)' then
    raise exception 'Existing team_rating_snapshots_team_idx is incompatible';
  end if;
end $$;

alter table public.league_matches add column if not exists source_name text;
alter table public.league_matches add column if not exists source_match_id text;
alter table public.league_matches add column if not exists team_a_opponent_id bigint;
alter table public.league_matches add column if not exists team_b_opponent_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.league_matches'::regclass
      and conname = 'league_matches_team_a_opponent_id_fkey'
  ) then
    alter table public.league_matches
      add constraint league_matches_team_a_opponent_id_fkey
      foreign key (team_a_opponent_id) references public.opponents(opponent_id);
  elsif (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.league_matches'::regclass and conname = 'league_matches_team_a_opponent_id_fkey')
        <> 'FOREIGN KEY (team_a_opponent_id) REFERENCES opponents(opponent_id)' then
    raise exception 'Existing league_matches_team_a_opponent_id_fkey is incompatible';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.league_matches'::regclass
      and conname = 'league_matches_team_b_opponent_id_fkey'
  ) then
    alter table public.league_matches
      add constraint league_matches_team_b_opponent_id_fkey
      foreign key (team_b_opponent_id) references public.opponents(opponent_id);
  elsif (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.league_matches'::regclass and conname = 'league_matches_team_b_opponent_id_fkey')
        <> 'FOREIGN KEY (team_b_opponent_id) REFERENCES opponents(opponent_id)' then
    raise exception 'Existing league_matches_team_b_opponent_id_fkey is incompatible';
  end if;
end $$;

create unique index if not exists league_matches_source_match_unique
  on public.league_matches(competition_id, format, source_name, source_match_id)
  where source_match_id is not null;

create table if not exists public.team_rating_snapshots (
  snapshot_id bigint generated by default as identity primary key,
  competition_id bigint not null references public.competitions(id) on delete cascade,
  format text not null,
  team_name_snapshot text not null,
  opponent_id bigint references public.opponents(opponent_id),
  round_label text not null,
  round_number integer not null,
  match_id bigint references public.league_matches(id) on delete cascade,
  snapshot_date date,
  rating numeric not null,
  overall_rank integer,
  tier_rank integer,
  rating_delta numeric not null default 0,
  model_version text not null,
  created_at timestamptz not null default now(),
  unique (competition_id, format, team_name_snapshot, round_number, match_id, model_version)
);

create index if not exists team_rating_snapshots_pool_round_idx
  on public.team_rating_snapshots(competition_id, format, round_number);
create index if not exists team_rating_snapshots_team_idx
  on public.team_rating_snapshots(team_name_snapshot, competition_id, format);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.team_rating_snapshots'::regclass
      and conname = 'team_rating_snapshots_format_valid'
  ) then
    alter table public.team_rating_snapshots
      add constraint team_rating_snapshots_format_valid
      check (format in ('2v2', '3v3')) not valid;
  elsif (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.team_rating_snapshots'::regclass and conname = 'team_rating_snapshots_format_valid')
        <> 'CHECK ((format = ANY (ARRAY[''2v2''::text, ''3v3''::text]))) NOT VALID' then
    raise exception 'Existing team_rating_snapshots_format_valid is incompatible';
  end if;
end $$;

alter table public.team_rating_snapshots enable row level security;

do $$
declare
  policy_row record;
begin
  select * into policy_row from pg_policies
  where schemaname = 'public' and tablename = 'team_rating_snapshots'
    and policyname = 'team_rating_snapshots_admin_read';
  if found and (policy_row.cmd <> 'SELECT' or policy_row.roles <> array['authenticated']::name[] or policy_row.qual not ilike '%site_admin%') then
    raise exception 'Existing team_rating_snapshots_admin_read policy is incompatible';
  elsif not found then
    create policy team_rating_snapshots_admin_read
      on public.team_rating_snapshots
      for select to authenticated
      using (coalesce((auth.jwt() -> 'app_metadata' ->> 'site_admin')::boolean, false));
  end if;

  select * into policy_row from pg_policies
  where schemaname = 'public' and tablename = 'team_rating_snapshots'
    and policyname = 'team_rating_snapshots_admin_write';
  if found and (policy_row.cmd <> 'ALL' or policy_row.roles <> array['authenticated']::name[] or policy_row.qual not ilike '%site_admin%' or policy_row.with_check not ilike '%site_admin%') then
    raise exception 'Existing team_rating_snapshots_admin_write policy is incompatible';
  elsif not found then
    create policy team_rating_snapshots_admin_write
      on public.team_rating_snapshots
      for all to authenticated
      using (coalesce((auth.jwt() -> 'app_metadata' ->> 'site_admin')::boolean, false))
      with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'site_admin')::boolean, false));
  end if;
end $$;

revoke all on table public.team_rating_snapshots from anon;
grant select, insert, update, delete on table public.team_rating_snapshots to authenticated;
grant usage, select on sequence public.team_rating_snapshots_snapshot_id_seq to authenticated;

comment on table public.team_rating_snapshots is
  'Immutable rating output for historical charts, opponent intelligence, and future FR Markets snapshots. Rebuild under a new model_version; never rewrite old market evidence.';
comment on column public.team_rating_snapshots.team_name_snapshot is
  'Historical imported display name. Canonical opponent identity may evolve independently.';

do $$
begin
  if to_regclass('public.team_rating_snapshots') is null
     or (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'team_rating_snapshots') <> 15
     or not (select relrowsecurity from pg_class where oid = 'public.team_rating_snapshots'::regclass)
     or (select count(*) from pg_policies where schemaname = 'public' and tablename = 'team_rating_snapshots' and policyname in ('team_rating_snapshots_admin_read','team_rating_snapshots_admin_write')) <> 2
     or not has_table_privilege('authenticated', 'public.team_rating_snapshots', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon', 'public.team_rating_snapshots', 'SELECT,INSERT,UPDATE,DELETE')
     or not has_sequence_privilege('authenticated', 'public.team_rating_snapshots_snapshot_id_seq', 'USAGE,SELECT') then
    raise exception 'Power compatibility postflight failed';
  end if;
end $$;

commit;
