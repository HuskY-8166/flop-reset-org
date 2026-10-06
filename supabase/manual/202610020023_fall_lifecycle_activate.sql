-- FLOP RESET V2.4 — FALL 2026 LIFECYCLE ACTIVATION
-- PREPARED ONLY. Do not execute before owner approval and opening-day verification.

begin;
set local lock_timeout = '5s';
lock table public.competitions in share row exclusive mode;
lock table public.competition_seasons in share row exclusive mode;

do $$
begin
  if (select count(*) from public.competition_seasons where season_id = 2 and slug = 'the-rivalry-fall-circuit-2026' and status = 'upcoming') <> 1 then
    raise exception 'Fall season 2 is missing, ambiguous, or no longer upcoming';
  end if;
  if (select count(*) from public.competitions where id in (3,4) and season_id = 2 and status = 'upcoming' and current_stage = 'upcoming') <> 2 then
    raise exception 'Fall competitions 3 and 4 drifted from the approved upcoming state';
  end if;
  if exists (
    select 1 from public.competitions
    where id in (3,4)
      and (lower(trim(league_name)) <> 'the rivalry'
        or lower(trim(circuit_name)) <> 'fall circuit'
        or season_year <> 2026
        or format not in ('2v2','3v3'))
  ) then
    raise exception 'Fall competition identity drifted';
  end if;
end $$;

create schema if not exists fr_release_backup;
create table if not exists fr_release_backup.fall_lifecycle_competitions_20261002 (
  competition_id bigint primary key,
  before_row jsonb not null,
  captured_at timestamptz not null default now()
);
create table if not exists fr_release_backup.fall_lifecycle_season_20261002 (
  season_id bigint primary key,
  before_row jsonb not null,
  captured_at timestamptz not null default now()
);

insert into fr_release_backup.fall_lifecycle_competitions_20261002 (competition_id, before_row)
select id, to_jsonb(c) from public.competitions c where id in (3,4)
on conflict (competition_id) do nothing;

insert into fr_release_backup.fall_lifecycle_season_20261002 (season_id, before_row)
select season_id, to_jsonb(s) from public.competition_seasons s where season_id = 2
on conflict (season_id) do nothing;

do $$
begin
  if (select count(*) from fr_release_backup.fall_lifecycle_competitions_20261002) <> 2
     or (select count(*) from fr_release_backup.fall_lifecycle_season_20261002) <> 1 then
    raise exception 'Fall lifecycle before-image capture failed';
  end if;
end $$;

update public.competitions
set status = 'active', current_stage = 'regular_season'
where id in (3,4);

update public.competition_seasons
set status = 'active', updated_at = now()
where season_id = 2;

do $$
begin
  if (select count(*) from public.competitions where id in (3,4) and status = 'active' and current_stage = 'regular_season') <> 2
     or (select count(*) from public.competition_seasons where season_id = 2 and status = 'active') <> 1 then
    raise exception 'Fall lifecycle activation postflight failed';
  end if;
end $$;

commit;
