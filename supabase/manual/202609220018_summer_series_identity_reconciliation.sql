-- PREPARED ONLY. CURRENTLY FAILS CLOSED ON PRODUCTION (2026-09-22).
-- Series 42 intentionally remains NULL until The Bozo Collective is verified.
-- All other mappings require a stable Rivalry team ID in a validated snapshot.

begin;

set local lock_timeout = '5s';
lock table public.series in share row exclusive mode;

create temp table expected_series_identity (
  series_id bigint primary key,
  historical_display_name text not null,
  expected_opponent_id bigint not null,
  expected_canonical_name text not null
) on commit drop;

insert into expected_series_identity values
  (32, 'SBC Blue Angels', 7, 'SBC Blue Angels'),
  (33, 'NBDA SOLAR', 2, 'NBDA SOLAR'),
  (34, 'GATOR SPORTS', 1, 'Gator Sports'),
  (35, 'DIVINE ZERO', 15, 'DIVINE ZERO'),
  (36, 'THE BURTON BATTLERS', 10, 'The Burton Battlers'),
  (37, 'SIMPLIFY BROWN', 6, 'SIMPLIFY BROWN'),
  (38, 'STORMCORE VORTEX', 12, 'STORMCORE VORTEX'),
  (39, 'SIMPLIFY GREEN', 5, 'SIMPLIFY GREEN'),
  (40, 'PHANTOM PRESSURE', 4, 'PHANTOM PRESSURE'),
  (41, 'KUNGFU TREACHERY', 3, 'KUNGFU TREACHERY'),
  (43, 'FAKE SQUAD', 11, 'FAKE SQUAD'),
  (44, 'PHANTISMS', 13, 'PHANTISMS'),
  (45, 'OHIO MIDLADS', 9, 'Ohio Midlads'),
  (46, 'SPARTAN ARES', 14, 'SPARTAN ARES');

do $$
begin
  if (select count(*) from expected_series_identity) <> 14 then
    raise exception 'Expected series identity list must contain exactly 14 rows';
  end if;
  if not exists (
    select 1 from public.series
    where series_id = 42 and competition_id = 2
      and opponent_name = ' THE BOZO COLLECTIVE' and opponent_id is null
  ) then
    raise exception 'Series 42 no longer matches the required unresolved state';
  end if;
  if exists (
    select 1
    from expected_series_identity x
    left join public.series s using (series_id)
    left join public.opponents o on o.opponent_id = x.expected_opponent_id
    where s.series_id is null
       or s.competition_id <> 2
       or s.opponent_name <> x.historical_display_name
       or s.opponent_id is not null
       or o.canonical_name <> x.expected_canonical_name
  ) then
    raise exception 'Series or canonical-opponent preflight changed';
  end if;

  if exists (
    select 1
    from expected_series_identity x
    where not exists (
      select 1
      from public.external_source_snapshots ss
      join public.competition_sources cs on cs.competition_source_id = ss.competition_source_id
      cross join lateral jsonb_array_elements(ss.normalized_payload -> 'entries') source_entry
      join public.external_team_sources ets
        on ets.provider = 'rivalry'
       and ets.external_team_id = source_entry ->> 'externalTeamId'
      where cs.competition_id = 2
        and cs.provider = 'rivalry'
        and ss.status in ('preview', 'applied')
        and ss.validation_errors = '[]'::jsonb
        and lower(trim(source_entry ->> 'displayName')) = lower(trim(x.historical_display_name))
        and nullif(source_entry ->> 'externalTeamId', '') is not null
        and ets.opponent_id = x.expected_opponent_id
    )
  ) then
    raise exception 'Blocked: one or more series mappings lack source-ID-backed snapshot evidence';
  end if;
end $$;

create schema if not exists fr_release_backup;
create table if not exists fr_release_backup.summer_series_identity_20260922 (
  series_id bigint primary key,
  opponent_id bigint,
  before_row jsonb not null,
  captured_at timestamptz not null default now()
);

insert into fr_release_backup.summer_series_identity_20260922 (series_id, opponent_id, before_row)
select s.series_id, s.opponent_id, to_jsonb(s)
from public.series s
join expected_series_identity x using (series_id)
on conflict (series_id) do nothing;

do $$
begin
  if (select count(*) from fr_release_backup.summer_series_identity_20260922) <> 14 then
    raise exception 'Series identity before-image count is not 14';
  end if;
end $$;

update public.series s
set opponent_id = x.expected_opponent_id
from expected_series_identity x
where s.series_id = x.series_id
  and s.competition_id = 2
  and s.opponent_id is null;

do $$
begin
  if exists (
    select 1 from expected_series_identity x
    join public.series s using (series_id)
    where s.opponent_id is distinct from x.expected_opponent_id
  ) or (select opponent_id from public.series where series_id = 42) is not null then
    raise exception 'Series identity post-write validation failed';
  end if;
end $$;

commit;

select series_id, opponent_name, opponent_id
from public.series
where series_id between 32 and 46
order by series_id;
