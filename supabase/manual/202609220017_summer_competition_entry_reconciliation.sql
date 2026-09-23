-- PREPARED ONLY. CURRENTLY FAILS CLOSED ON PRODUCTION (2026-09-22).
-- Do not fill identities by name alone. This script becomes executable only
-- after a validated Rivalry snapshot and stable external-team mappings exist.

begin;

set local lock_timeout = '5s';
lock table public.competition_entries in share row exclusive mode;

create temp table expected_entry_identity (
  entry_id bigint primary key,
  historical_display_name text not null,
  expected_opponent_id bigint not null,
  expected_canonical_name text not null
) on commit drop;

insert into expected_entry_identity values
  (156, 'StormCore Vortex', 12, 'STORMCORE VORTEX'),
  (157, 'Phantisms', 13, 'PHANTISMS'),
  (135, 'Gator Sports', 1, 'Gator Sports'),
  (137, 'Simplify Green', 5, 'SIMPLIFY GREEN'),
  (143, 'Simplify Brown', 6, 'SIMPLIFY BROWN'),
  (149, 'Spartan Ares', 14, 'SPARTAN ARES'),
  (124, 'Ohio Midlads', 9, 'Ohio Midlads'),
  (127, 'Phantom Pressure', 4, 'PHANTOM PRESSURE'),
  (130, 'The Burton Battlers', 10, 'The Burton Battlers'),
  (132, 'SBC Blue Angels', 7, 'SBC Blue Angels'),
  (150, 'Fake Squad', 11, 'FAKE SQUAD');

do $$
begin
  if (select count(*) from expected_entry_identity) <> 11 then
    raise exception 'Expected identity list must contain exactly 11 rows';
  end if;

  if exists (
    select 1
    from expected_entry_identity x
    left join public.competition_entries e on e.entry_id = x.entry_id
    left join public.opponents o on o.opponent_id = x.expected_opponent_id
    where e.entry_id is null
       or e.competition_id <> 2
       or e.display_name_snapshot <> x.historical_display_name
       or e.opponent_id is not null
       or o.canonical_name <> x.expected_canonical_name
  ) then
    raise exception 'Entry or canonical-opponent preflight changed';
  end if;

  if not exists (
    select 1 from public.competition_sources
    where competition_id = 2 and provider = 'rivalry'
      and source_status in ('previewed', 'synced')
  ) then
    raise exception 'Blocked: competition 2 has no reviewed Rivalry source record';
  end if;

  if exists (
    select 1
    from expected_entry_identity x
    join public.competition_entries e on e.entry_id = x.entry_id
    where e.source_provider is distinct from 'rivalry'
       or nullif(e.source_external_id, '') is null
       or e.external_source_id is null
       or not exists (
         select 1
         from public.external_team_sources ets
         where ets.source_id = e.external_source_id
           and ets.provider = 'rivalry'
           and ets.external_team_id = e.source_external_id
           and ets.opponent_id = x.expected_opponent_id
       )
       or not exists (
         select 1
         from public.external_source_snapshots ss
         join public.competition_sources cs on cs.competition_source_id = ss.competition_source_id
         cross join lateral jsonb_array_elements(ss.normalized_payload -> 'entries') source_entry
         where cs.competition_id = 2
           and cs.provider = 'rivalry'
           and ss.status in ('preview', 'applied')
           and ss.validation_errors = '[]'::jsonb
           and source_entry ->> 'externalTeamId' = e.source_external_id
           and source_entry ->> 'displayName' = e.display_name_snapshot
       )
  ) then
    raise exception 'Blocked: one or more candidates lack a source-ID-backed snapshot match';
  end if;
end $$;

create schema if not exists fr_release_backup;
create table if not exists fr_release_backup.summer_entry_identity_20260922 (
  entry_id bigint primary key,
  opponent_id bigint,
  before_row jsonb not null,
  captured_at timestamptz not null default now()
);

insert into fr_release_backup.summer_entry_identity_20260922 (entry_id, opponent_id, before_row)
select e.entry_id, e.opponent_id, to_jsonb(e)
from public.competition_entries e
join expected_entry_identity x using (entry_id)
on conflict (entry_id) do nothing;

do $$
begin
  if (select count(*) from fr_release_backup.summer_entry_identity_20260922) <> 11 then
    raise exception 'Entry identity before-image count is not 11';
  end if;
end $$;

update public.competition_entries e
set opponent_id = x.expected_opponent_id,
    updated_at = now()
from expected_entry_identity x
where e.entry_id = x.entry_id
  and e.competition_id = 2
  and e.opponent_id is null;

do $$
begin
  if exists (
    select 1 from expected_entry_identity x
    join public.competition_entries e using (entry_id)
    where e.opponent_id is distinct from x.expected_opponent_id
  ) then
    raise exception 'Competition entry identity post-write validation failed';
  end if;
end $$;

commit;

select e.entry_id, e.display_name_snapshot, e.source_external_id, e.opponent_id,
       o.canonical_name
from public.competition_entries e
join public.opponents o on o.opponent_id = e.opponent_id
where e.entry_id in (124,127,130,132,135,137,143,149,150,156,157)
order by e.entry_id;
