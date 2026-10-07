-- FLOP RESET V2.4 — PUBLISH VERIFIED FALL 2026 ROUND 1 FIXTURES
-- Production data change. Run only after migration 019 and Fall lifecycle activation.
-- Does not create results, stats, Power snapshots, or modify Summer history.

begin;
set local lock_timeout = '5s';
lock table public.competition_entries in share row exclusive mode;
lock table public.opponents in share row exclusive mode;
lock table public.opponent_aliases in share row exclusive mode;
lock table public.scheduled_matches in share row exclusive mode;

do $$
begin
  if (select count(*) from public.competitions where id in (3,4) and season_id = 2 and status = 'active' and current_stage = 'regular_season') <> 2 then
    raise exception 'Fall competitions 3 and 4 must be active before fixture publication';
  end if;
  if exists (
    select 1
    from (values
      (161::bigint,3::bigint,5::bigint,'FRCS'::text),
      (166::bigint,3::bigint,8::bigint,'rat summer'::text),
      (162::bigint,4::bigint,1::bigint,'Flop Reset | Fracture'::text),
      (163::bigint,4::bigint,3::bigint,'Flop Reset | Frameshift'::text),
      (164::bigint,4::bigint,6::bigint,'Flop Reset | Future'::text),
      (165::bigint,4::bigint,7::bigint,'FRCS'::text)
    ) expected(entry_id, competition_id, fr_team_id, display_name_snapshot)
    left join public.competition_entries actual using (entry_id)
    where actual.entry_id is null
       or actual.competition_id is distinct from expected.competition_id
       or actual.fr_team_id is distinct from expected.fr_team_id
       or actual.display_name_snapshot is distinct from expected.display_name_snapshot
  ) then
    raise exception 'Fall entry display identity drifted';
  end if;
  if exists (select 1 from public.scheduled_matches where competition_entry_id in (161,162,163,164,165,166)) then
    raise exception 'At least one target entry already has a fixture; review instead of rerunning';
  end if;
end $$;

create schema if not exists fr_release_backup;
create table if not exists fr_release_backup.fall_round1_entry_tiers_20261006 (
  entry_id bigint primary key,
  before_tier text,
  captured_at timestamptz not null default now()
);
create table if not exists fr_release_backup.fall_round1_opponents_20261006 (
  requested_name text primary key,
  opponent_id bigint not null,
  created_opponent boolean not null,
  created_alias_id bigint,
  captured_at timestamptz not null default now()
);
create table if not exists fr_release_backup.fall_round1_fixtures_20261006 (
  entry_id bigint primary key,
  scheduled_id bigint not null unique,
  captured_at timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from fr_release_backup.fall_round1_entry_tiers_20261006)
     or exists (select 1 from fr_release_backup.fall_round1_opponents_20261006)
     or exists (select 1 from fr_release_backup.fall_round1_fixtures_20261006) then
    raise exception 'Round 1 backup already contains rows; do not rerun';
  end if;
end $$;

insert into fr_release_backup.fall_round1_entry_tiers_20261006 (entry_id, before_tier)
select entry_id, tier from public.competition_entries where entry_id in (161,162,163,164,165,166);

do $$
begin
  if (select count(*) from fr_release_backup.fall_round1_entry_tiers_20261006) <> 6 then
    raise exception 'Entry tier before-image capture failed';
  end if;
end $$;

update public.competition_entries e
set tier = v.tier, updated_at = now()
from (values
  (161::bigint, 'Tier 3'::text),
  (162::bigint, 'Tier 4'::text),
  (163::bigint, 'Tier 6'::text),
  (164::bigint, 'Tier 4'::text),
  (165::bigint, 'Tier 3'::text),
  (166::bigint, 'Tier 6'::text)
) as v(entry_id, tier)
where e.entry_id = v.entry_id;

create temporary table desired_round1_opponents (requested_name text primary key) on commit drop;
insert into desired_round1_opponents values
  ('SE Midnight'), ('NAE Reaper'), ('Rag Men Esports'),
  ('NBDA Forge'), ('Kung-Fu Treachery'), ('Acid Pioneers');

do $$
declare
  desired record;
  resolved_id bigint;
  matched_ids bigint[];
  was_created boolean;
  new_alias_id bigint;
  compact_key text;
  canonical text;
begin
  for desired in select requested_name from desired_round1_opponents order by requested_name loop
    compact_key := regexp_replace(lower(trim(desired.requested_name)), '[^a-z0-9]+', '', 'g');
    select array_agg(distinct candidate_id order by candidate_id) into matched_ids
    from (
      select opponent_id as candidate_id from public.opponents
      where regexp_replace(lower(trim(canonical_name)), '[^a-z0-9]+', '', 'g') = compact_key
      union
      select opponent_id from public.opponent_aliases
      where regexp_replace(lower(trim(alias)), '[^a-z0-9]+', '', 'g') = compact_key
    ) candidates;

    if coalesce(array_length(matched_ids, 1), 0) > 1 then
      raise exception 'Ambiguous canonical opponent identity for %: %', desired.requested_name, matched_ids;
    elsif coalesce(array_length(matched_ids, 1), 0) = 1 then
      resolved_id := matched_ids[1];
      was_created := false;
    else
      insert into public.opponents (canonical_name)
      values (desired.requested_name)
      returning opponent_id into resolved_id;
      was_created := true;
    end if;

    new_alias_id := null;
    select canonical_name into canonical from public.opponents where opponent_id = resolved_id;
    if not was_created and lower(trim(canonical)) <> lower(trim(desired.requested_name))
       and not exists (select 1 from public.opponent_aliases where normalized_alias = lower(trim(desired.requested_name))) then
      insert into public.opponent_aliases (opponent_id, alias)
      values (resolved_id, desired.requested_name)
      returning opponent_aliases.alias_id into new_alias_id;
    end if;

    insert into fr_release_backup.fall_round1_opponents_20261006
      (requested_name, opponent_id, created_opponent, created_alias_id)
    values (desired.requested_name, resolved_id, was_created, new_alias_id);
  end loop;
end $$;

do $$
declare
  fixture record;
  new_id bigint;
  resolved_opponent_id bigint;
  competition_url text;
begin
  for fixture in
    select * from (values
      (3::bigint,161::bigint,'SE Midnight'::text,'2026-10-05'::date,'Tier 3'::text),
      (3::bigint,166::bigint,'NAE Reaper'::text,'2026-10-05'::date,'Tier 6'::text),
      (4::bigint,165::bigint,'Rag Men Esports'::text,'2026-10-05'::date,'Tier 3'::text),
      (4::bigint,163::bigint,'NBDA Forge'::text,'2026-10-09'::date,'Tier 6'::text),
      (4::bigint,162::bigint,'Kung-Fu Treachery'::text,'2026-10-05'::date,'Tier 4'::text),
      (4::bigint,164::bigint,'Acid Pioneers'::text,'2026-10-05'::date,'Tier 4'::text)
    ) f(competition_id, entry_id, opponent_name, match_date, tier)
  loop
    select opponent_id into strict resolved_opponent_id
    from fr_release_backup.fall_round1_opponents_20261006 where requested_name = fixture.opponent_name;
    select external_url into strict competition_url from public.competitions where id = fixture.competition_id;

    insert into public.scheduled_matches (
      competition_id, competition_entry_id, flop_reset_team_id, opponent_id, opponent_name,
      match_date, match_time, scheduled_local_time, scheduled_time_source, scheduled_time_locked,
      starts_at, timezone, best_of, competition_phase, stage_label, tier,
      source_provider, source_external_id, source_url, status, notes
    )
    select
      fixture.competition_id, e.entry_id, e.fr_team_id, resolved_opponent_id, fixture.opponent_name,
      fixture.match_date, null, null, 'tbd', true,
      null, 'America/New_York', 5, 'regular_season', 'Round 1', fixture.tier,
      'Rivalry', null, competition_url, 'scheduled', 'Verified Fall 2026 Round 1 fixture; exact time is owner-managed and TBD.'
    from public.competition_entries e where e.entry_id = fixture.entry_id
    returning scheduled_id into new_id;

    insert into fr_release_backup.fall_round1_fixtures_20261006 (entry_id, scheduled_id)
    values (fixture.entry_id, new_id);
  end loop;
end $$;

do $$
begin
  if (select count(*) from fr_release_backup.fall_round1_opponents_20261006) <> 6
     or (select count(*) from fr_release_backup.fall_round1_fixtures_20261006) <> 6 then
    raise exception 'Round 1 opponent or fixture capture failed';
  end if;
  if (select count(*) from public.scheduled_matches s join fr_release_backup.fall_round1_fixtures_20261006 b using (scheduled_id)
      where s.status = 'scheduled' and s.scheduled_local_time is null and s.match_time is null
        and s.scheduled_time_locked and s.best_of = 5 and s.competition_phase = 'regular_season'
        and s.stage_label = 'Round 1' and s.tier in ('Tier 3','Tier 4','Tier 6')) <> 6 then
    raise exception 'Round 1 fixture postflight failed';
  end if;
end $$;

commit;

select b.entry_id, b.scheduled_id, s.flop_reset_team_id, s.opponent_id, s.opponent_name,
       s.match_date, s.scheduled_local_time, s.timezone, s.tier, s.stage_label,
       s.best_of, s.competition_phase, s.status
from fr_release_backup.fall_round1_fixtures_20261006 b
join public.scheduled_matches s using (scheduled_id)
order by b.entry_id;
