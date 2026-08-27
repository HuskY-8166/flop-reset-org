-- READ ONLY — run before the V2.3.8 manual reset.

select 'competitions' as metric, count(*)::text as value from public.competitions
union all select 'teams', count(*)::text from public.teams
union all select 'players', count(*)::text from public.players
union all select 'player_team_memberships', count(*)::text from public.player_team_memberships
union all select 'opponents', count(*)::text from public.opponents
union all select 'opponent_aliases', count(*)::text from public.opponent_aliases
union all select 'scheduled_matches', count(*)::text from public.scheduled_matches
union all select 'playoff_brackets', count(*)::text from public.playoff_brackets
union all select 'playoff_matches', count(*)::text from public.playoff_matches
union all select 'series', count(*)::text from public.series
union all select 'matches', count(*)::text from public.matches
union all select 'match_player_stats', count(*)::text from public.match_player_stats
union all select 'league_matches', count(*)::text from public.league_matches
union all select 'non_forfeit_match_rows', count(*)::text from public.matches where not coalesce(is_forfeit, false)
union all select 'official_played_games', count(*)::text from public.matches where series_id is not null and not coalesce(is_forfeit, false)
union all select 'official_played_games_with_player_stats', count(distinct m.match_id)::text
from public.matches m join public.match_player_stats ps on ps.match_id = m.match_id
where m.series_id is not null and not coalesce(m.is_forfeit, false)
union all select 'matches_without_series', count(*)::text from public.matches where series_id is null
union all select 'legacy_forfeit_game_rows', count(*)::text from public.matches where coalesce(is_forfeit, false)
union all select 'linked_forfeit_series', count(distinct series_id)::text from public.matches where coalesce(is_forfeit, false) and series_id is not null
union all select 'replay_ids', count(*)::text from public.matches where replay_id is not null
union all select 'official_played_games_with_replay_id', count(*)::text
from public.matches where series_id is not null and not coalesce(is_forfeit, false) and replay_id is not null
union all select 'official_played_games_without_replay_id', count(*)::text
from public.matches where series_id is not null and not coalesce(is_forfeit, false) and replay_id is null
union all select 'duplicate_replay_ids', count(*)::text from (
  select replay_id from public.matches where replay_id is not null group by replay_id having count(*) > 1
) duplicates
union all select 'competition_format_mismatches', count(*)::text
from public.series s
join public.competitions c on c.id = s.competition_id
join public.teams t on t.id = s.flop_reset_team_id
where c.format is distinct from t.format;

-- Required import identities. Each row must report ready = true.
select
  name,
  aliases,
  case name
    when 'aktionrl' then 'AkTION' = any(coalesce(aliases, '{}'::text[]))
    when 'droll' then 'Drollotov' = any(coalesce(aliases, '{}'::text[]))
    when 'HuskY' then 'HuskY.G2' = any(coalesce(aliases, '{}'::text[]))
    else false
  end as ready
from public.players
where name in ('aktionrl', 'droll', 'HuskY')
order by name;

select
  o.opponent_id,
  o.canonical_name,
  o.normalized_name,
  a.alias,
  a.normalized_alias,
  (
    (o.normalized_name = 'ohio midlads' and a.normalized_alias = 'midlads')
    or (o.normalized_name = 'sbc blue angels' and a.normalized_alias = 'sbc angels')
  ) as ready
from public.opponents o
join public.opponent_aliases a on a.opponent_id = o.opponent_id
where a.normalized_alias in ('midlads', 'sbc angels')
order by o.normalized_name, a.normalized_alias;

-- Every row excluded from official played-game totals, with the reason made
-- explicit before destructive history cleanup.
select
  m.match_id,
  m.series_id,
  coalesce(nullif(trim(m.opponent_name), ''), s.opponent_name) as opponent,
  coalesce(m.is_forfeit, false) as is_forfeit,
  m.flop_reset_score,
  m.opponent_score,
  m.result_override as result_state,
  case
    when coalesce(m.is_forfeit, false) and m.series_id is null then 'legacy unlinked forfeit row; zero played games'
    when coalesce(m.is_forfeit, false) then 'legacy linked forfeit row; official series result but zero played games'
    when m.series_id is null then 'unlinked non-forfeit legacy row; not an official series game'
    else 'included official played game'
  end as exclusion_reason
from public.matches m
left join public.series s on s.series_id = m.series_id
where coalesce(m.is_forfeit, false) or m.series_id is null
order by m.match_id;

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
  )
order by target_table, source_table, constraint_name;
