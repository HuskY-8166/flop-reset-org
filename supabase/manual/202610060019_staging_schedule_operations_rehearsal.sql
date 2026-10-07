-- HOSTED STAGING ONLY — migration 019 behavioral rehearsal.
-- All synthetic rows remain inside this transaction and are rolled back.

begin;
set local lock_timeout = '5s';

do $$
begin
  if current_database() is null then raise exception 'Database context unavailable'; end if;
  if exists (select 1 from public.competitions where id = -8819)
     or exists (select 1 from public.scheduled_matches where competition_id = -8819) then
    raise exception 'Synthetic migration-019 IDs are already in use';
  end if;
end $$;

insert into public.competition_seasons (season_id, league_name, season_name, season_year, slug, status)
values (-8819, 'QA Rivalry', 'Schedule Rehearsal', 2026, 'qa-schedule-rehearsal-2026', 'upcoming');
insert into public.competitions (id, name, host, format, external_url, league_name, circuit_name, season_year, region, status, current_stage, season_id, start_date, end_date)
values (-8819, 'QA Schedule 2026 | 3v3', 'QA Rivalry', '3v3', 'https://example.com/qa-schedule', 'QA Rivalry', 'Schedule Rehearsal', 2026, 'US-East', 'upcoming', 'upcoming', -8819, '2026-10-05', '2026-12-21');
insert into public.teams (id, name, format, active, display_name, slug)
values (-8819, 'QA Schedule Team', '3v3', true, 'QA Schedule Team', 'qa-schedule-team');
insert into public.opponents (opponent_id, canonical_name, display_name, status) values
  (-8819, 'QA Schedule Opponent', 'QA Schedule Opponent', 'active'),
  (-8820, 'QA Conflicting Opponent', 'QA Conflicting Opponent', 'active');
insert into public.competition_entries (entry_id, competition_id, fr_team_id, slug, display_name_snapshot, tier, registration_status, competitive_status, status)
values (-8819, -8819, -8819, 'qa-schedule-team-entry', 'QA Schedule Team', 'Tier QA', 'registered', 'active', 'active');

set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"site_admin":true}}';

select public.create_verified_scheduled_match(jsonb_build_object(
  'competition_id', -8819, 'competition_entry_id', -8819, 'flop_reset_team_id', -8819,
  'opponent_id', -8819, 'match_date', '2026-10-05', 'scheduled_local_time', null,
  'timezone', 'America/New_York', 'best_of', 5, 'competition_phase', 'regular_season',
  'stage_label', 'Round 1', 'source_provider', 'Rivalry', 'source_external_id', 'qa-match-1',
  'source_url', 'https://example.com/qa-schedule/matches/qa-match-1'
));

do $$
declare fixture_id bigint;
begin
  select scheduled_id into strict fixture_id from public.scheduled_matches where competition_id = -8819;
  if exists (select 1 from public.scheduled_matches where scheduled_id = fixture_id and scheduled_local_time is not null) then
    raise exception 'Date-only Time TBD fixture was not preserved';
  end if;

  begin
    perform public.create_verified_scheduled_match(jsonb_build_object(
      'competition_id', -8819, 'competition_entry_id', -8819, 'flop_reset_team_id', -8819,
      'opponent_id', -8819, 'match_date', '2026-10-05', 'scheduled_local_time', '20:00',
      'timezone', 'America/New_York', 'best_of', 5, 'competition_phase', 'regular_season',
      'stage_label', 'Round 1', 'source_provider', 'Rivalry', 'source_external_id', 'qa-match-1'
    ));
    raise exception 'Exact duplicate unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'Exact duplicate unexpectedly succeeded' then raise; end if;
  end;

  begin
    perform public.create_verified_scheduled_match(jsonb_build_object(
      'competition_id', -8819, 'competition_entry_id', -8819, 'flop_reset_team_id', -8819,
      'opponent_id', -8820, 'match_date', '2026-10-06', 'scheduled_local_time', null,
      'timezone', 'America/New_York', 'best_of', 5, 'competition_phase', 'regular_season',
      'stage_label', 'Round 1', 'source_provider', 'Rivalry', 'source_external_id', 'qa-match-1'
    ));
    raise exception 'Source-ID conflict unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'Source-ID conflict unexpectedly succeeded' then raise; end if;
  end;

  perform public.set_scheduled_match_local_time(fixture_id, '20:30'::time, 'America/New_York');
  if (select scheduled_local_time from public.scheduled_matches where scheduled_id = fixture_id) <> '20:30'::time
     or (select count(*) from public.scheduled_matches where competition_id = -8819) <> 1 then
    raise exception 'Manual time enrichment did not update the original fixture';
  end if;

  begin
    update public.scheduled_matches set scheduled_local_time = '21:00'::time, match_time = '21:00'
    where scheduled_id = fixture_id;
    raise exception 'Locked owner time was overwritten directly';
  exception when others then
    if sqlerrm = 'Locked owner time was overwritten directly' then raise; end if;
  end;

  insert into public.series (
    series_id, competition_id, flop_reset_team_id, opponent_name, opponent_id,
    best_of, series_date, competition_phase, scheduled_match_id
  ) values (-8819, -8819, -8819, 'QA Schedule Opponent', -8819, 5, '2026-10-05', 'regular_season', fixture_id);
  if (select status from public.scheduled_matches where scheduled_id = fixture_id) <> 'completed' then
    raise exception 'Linked result did not complete the fixture';
  end if;
  delete from public.series where series_id = -8819;
  if (select status from public.scheduled_matches where scheduled_id = fixture_id) <> 'scheduled' then
    raise exception 'Failed-import cleanup did not restore scheduled status';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.create_verified_scheduled_match(jsonb)', 'EXECUTE') then
    raise exception 'Anon unexpectedly has create-schedule RPC execute';
  end if;
  if not has_function_privilege('authenticated', 'public.create_verified_scheduled_match(jsonb)', 'EXECUTE') then
    raise exception 'Authenticated role is missing create-schedule RPC execute';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'scheduled_matches'
      and roles @> array['authenticated']::name[]
  ) then
    raise exception 'Expected authenticated/site-admin schedule RLS policy is missing';
  end if;
end $$;

set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"site_admin":false}}';
do $$
begin
  begin
    perform public.set_scheduled_match_local_time(
      (select scheduled_id from public.scheduled_matches where competition_id = -8819),
      '19:00'::time, 'America/New_York'
    );
    raise exception 'Non-admin time edit unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'Non-admin time edit unexpectedly succeeded' then raise; end if;
  end;
end $$;

rollback;

select 'migration 019 rehearsal passed; synthetic rows rolled back' as result;
