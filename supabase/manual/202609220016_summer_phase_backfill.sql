-- PREPARED ONLY. DO NOT RUN UNTIL REVIEWED IN A SUPABASE BRANCH.
-- Summer 2026 phase backfill. Exact production before-image observed 2026-09-22.
-- Affects series 32-46 and league_matches 767-1168 only.

begin;

set local lock_timeout = '5s';
lock table public.series in share row exclusive mode;
lock table public.league_matches in share row exclusive mode;

create schema if not exists fr_release_backup;

create table if not exists fr_release_backup.summer_phase_series_20260922 (
  series_id bigint primary key,
  competition_id bigint not null,
  competition_phase text,
  before_row jsonb not null,
  captured_at timestamptz not null default now()
);

create table if not exists fr_release_backup.summer_phase_league_matches_20260922 (
  league_match_id bigint primary key,
  competition_id bigint not null,
  competition_phase text,
  before_row jsonb not null,
  captured_at timestamptz not null default now()
);

do $$
declare
  expected_series_ids bigint[] := array(select generate_series(32, 46)::bigint);
  actual_series_ids bigint[];
  expected_league_ids bigint[] := array(select generate_series(767, 1168)::bigint);
  actual_league_ids bigint[];
begin
  select array_agg(series_id order by series_id)
    into actual_series_ids
  from public.series
  where series_id between 32 and 46
    and competition_id = 2
    and competition_phase is null;

  if actual_series_ids is distinct from expected_series_ids then
    raise exception 'Series preflight failed: expected exactly IDs 32-46 in competition 2 with NULL phase';
  end if;

  select array_agg(id order by id)
    into actual_league_ids
  from public.league_matches
  where id between 767 and 1168
    and competition_id in (1, 2)
    and competition_phase is null;

  if actual_league_ids is distinct from expected_league_ids then
    raise exception 'League preflight failed: expected exactly IDs 767-1168 in competitions 1/2 with NULL phase';
  end if;

  if (select count(*) from public.league_matches where id between 767 and 1168 and competition_id = 1) <> 171
     or (select count(*) from public.league_matches where id between 767 and 1168 and competition_id = 2) <> 231 then
    raise exception 'League competition split changed: expected 171 rows for competition 1 and 231 for competition 2';
  end if;

  if (select count(*) from fr_release_backup.summer_phase_series_20260922) not in (0, 15) then
    raise exception 'Series backup is partial; stop and inspect fr_release_backup';
  end if;
  if (select count(*) from fr_release_backup.summer_phase_league_matches_20260922) not in (0, 402) then
    raise exception 'League backup is partial; stop and inspect fr_release_backup';
  end if;
end $$;

insert into fr_release_backup.summer_phase_series_20260922 (
  series_id, competition_id, competition_phase, before_row
)
select series_id, competition_id, competition_phase, to_jsonb(s)
from public.series s
where series_id between 32 and 46
on conflict (series_id) do nothing;

insert into fr_release_backup.summer_phase_league_matches_20260922 (
  league_match_id, competition_id, competition_phase, before_row
)
select id, competition_id, competition_phase, to_jsonb(lm)
from public.league_matches lm
where id between 767 and 1168
on conflict (league_match_id) do nothing;

do $$
begin
  if (select count(*) from fr_release_backup.summer_phase_series_20260922) <> 15 then
    raise exception 'Series before-image did not capture all 15 rows';
  end if;
  if (select count(*) from fr_release_backup.summer_phase_league_matches_20260922) <> 402 then
    raise exception 'League before-image did not capture all 402 rows';
  end if;
end $$;

update public.series
set competition_phase = 'regular_season'
where series_id between 32 and 46
  and competition_id = 2
  and competition_phase is null;

do $$
begin
  if (select count(*) from public.series where series_id between 32 and 46 and competition_id = 2 and competition_phase = 'regular_season') <> 15 then
    raise exception 'Series post-write validation failed';
  end if;
end $$;

update public.league_matches
set competition_phase = 'regular_season'
where id between 767 and 1168
  and competition_id in (1, 2)
  and competition_phase is null;

do $$
begin
  if (select count(*) from public.league_matches where id between 767 and 1168 and competition_id in (1, 2) and competition_phase = 'regular_season') <> 402 then
    raise exception 'League post-write validation failed';
  end if;
  if exists (select 1 from public.series where series_id between 32 and 46 and competition_phase is null)
     or exists (select 1 from public.league_matches where id between 767 and 1168 and competition_phase is null) then
    raise exception 'Phase backfill left targeted NULL values';
  end if;
end $$;

commit;

-- Post-commit validation (read-only).
select competition_id, competition_phase, count(*)
from public.league_matches
where id between 767 and 1168
group by competition_id, competition_phase
order by competition_id, competition_phase;

select competition_id, competition_phase, count(*)
from public.series
where series_id between 32 and 46
group by competition_id, competition_phase
order by competition_id, competition_phase;
