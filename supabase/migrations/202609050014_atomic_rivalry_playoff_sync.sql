-- Apply a fully validated Rivalry playoff diff as one transaction. Any stale
-- row, finalized result, or unsupported patch aborts the entire RPC call.
create or replace function public.apply_rivalry_playoff_sync(proposed_updates jsonb)
returns table(playoff_match_id bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  target public.playoff_matches%rowtype;
  expected jsonb;
  patch jsonb;
  allowed_keys constant text[] := array[
    'team_a_name','team_b_name','competition_entry_a_id','competition_entry_b_id',
    'score_a','score_b','winner_side','winner_name','is_bye','is_forfeit','status'
  ];
begin
  if jsonb_typeof(proposed_updates) <> 'array' then
    raise exception 'proposed_updates must be a JSON array';
  end if;

  for item in select value from jsonb_array_elements(proposed_updates)
  loop
    expected := coalesce(item -> 'expected', '{}'::jsonb);
    patch := coalesce(item -> 'patch', '{}'::jsonb);
    if exists (select 1 from jsonb_object_keys(patch) key where not (key = any(allowed_keys))) then
      raise exception 'Unsupported playoff sync patch key';
    end if;

    select * into target
    from public.playoff_matches pm
    where pm.playoff_match_id = (item ->> 'playoff_match_id')::bigint
    for update;

    if not found then raise exception 'Playoff match does not exist'; end if;
    if target.status = 'final' then raise exception 'Final playoff match is protected'; end if;
    if target.status is distinct from item ->> 'expected_status'
      or to_jsonb(target) -> 'team_a_name' is distinct from expected -> 'team_a_name'
      or to_jsonb(target) -> 'team_b_name' is distinct from expected -> 'team_b_name'
      or to_jsonb(target) -> 'competition_entry_a_id' is distinct from expected -> 'competition_entry_a_id'
      or to_jsonb(target) -> 'competition_entry_b_id' is distinct from expected -> 'competition_entry_b_id'
      or to_jsonb(target) -> 'score_a' is distinct from expected -> 'score_a'
      or to_jsonb(target) -> 'score_b' is distinct from expected -> 'score_b'
      or to_jsonb(target) -> 'winner_side' is distinct from expected -> 'winner_side'
      or to_jsonb(target) -> 'is_bye' is distinct from expected -> 'is_bye'
      or to_jsonb(target) -> 'is_forfeit' is distinct from expected -> 'is_forfeit'
    then
      raise exception 'Playoff match changed during synchronization';
    end if;

    update public.playoff_matches pm set
      team_a_name = case when patch ? 'team_a_name' then patch ->> 'team_a_name' else pm.team_a_name end,
      team_b_name = case when patch ? 'team_b_name' then patch ->> 'team_b_name' else pm.team_b_name end,
      competition_entry_a_id = case when patch ? 'competition_entry_a_id' then (patch ->> 'competition_entry_a_id')::bigint else pm.competition_entry_a_id end,
      competition_entry_b_id = case when patch ? 'competition_entry_b_id' then (patch ->> 'competition_entry_b_id')::bigint else pm.competition_entry_b_id end,
      score_a = case when patch ? 'score_a' then (patch ->> 'score_a')::integer else pm.score_a end,
      score_b = case when patch ? 'score_b' then (patch ->> 'score_b')::integer else pm.score_b end,
      winner_side = case when patch ? 'winner_side' then (patch ->> 'winner_side')::integer else pm.winner_side end,
      winner_name = case when patch ? 'winner_name' then patch ->> 'winner_name' else pm.winner_name end,
      is_bye = case when patch ? 'is_bye' then (patch ->> 'is_bye')::boolean else pm.is_bye end,
      is_forfeit = case when patch ? 'is_forfeit' then (patch ->> 'is_forfeit')::boolean else pm.is_forfeit end,
      status = case when patch ? 'status' then patch ->> 'status' else pm.status end
    where pm.playoff_match_id = target.playoff_match_id;

    playoff_match_id := target.playoff_match_id;
    return next;
  end loop;
end;
$$;

revoke all on function public.apply_rivalry_playoff_sync(jsonb) from public, anon, authenticated;
grant execute on function public.apply_rivalry_playoff_sync(jsonb) to service_role;
