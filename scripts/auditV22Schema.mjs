import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) throw new Error('Supabase environment variables are required.')

const supabase = createClient(url, key)

const probes = {
  competitions: 'id,name,format,host,league_name,circuit_name,season_year,status,start_date,end_date,region,country,timezone',
  matches: 'match_id,series_id,competition_id,flop_reset_team_id,is_forfeit,forfeit_result,result_override,played_at,game_number,result_note',
  scheduled_matches: 'scheduled_id,competition_id,flop_reset_team_id,opponent_name,opponent_id,starts_at,status',
  players: 'player_id,name,team_id,status,retired_at,aliases',
  series: 'series_id,competition_id,flop_reset_team_id,opponent_name,opponent_id,series_date,best_of',
  player_team_memberships: '*',
  opponents: '*',
  opponent_aliases: '*',
  playoff_brackets: '*',
  playoff_matches: '*',
  league_matches: 'id,competition_id,format,round,tier,team_a,team_b,status',
}

const columnCandidates = {
  matches: [
    'match_id', 'series_id', 'competition_id', 'flop_reset_team_id',
    'flop_reset_score', 'opponent_score', 'is_forfeit', 'forfeit_result',
    'result_override', 'played_at', 'game_number', 'result_note', 'round',
    'match_date', 'replay_id',
  ],
  playoff_brackets: [
    'bracket_id', 'id', 'competition_id', 'name', 'title', 'tier', 'format',
    'status', 'stage', 'starts_at', 'created_at', 'updated_at', 'metadata',
  ],
  playoff_matches: [
    'playoff_match_id', 'match_id', 'id', 'bracket_id', 'round', 'round_name',
    'round_number', 'match_order', 'position', 'slot', 'team_a', 'team_b',
    'team_a_name', 'team_b_name', 'participant_one', 'participant_two',
    'score_a', 'score_b', 'winner', 'winner_name', 'winner_side', 'status',
    'is_bye', 'series_id', 'scheduled_match_id', 'next_match_id', 'next_slot',
    'loser_next_match_id', 'loser_next_slot', 'starts_at', 'notes',
    'team_one', 'team_two', 'team_one_name', 'team_two_name',
    'participant_a', 'participant_b', 'participant_a_name', 'participant_b_name',
    'participant_one_name', 'participant_two_name', 'home_team', 'away_team',
    'home_team_name', 'away_team_name', 'slot_a', 'slot_b', 'slot_a_name',
    'slot_b_name', 'side_a', 'side_b', 'seed_a', 'seed_b', 'team_a_seed',
    'team_b_seed', 'participant_a_source', 'participant_b_source',
    'team_a_source_match_id', 'team_b_source_match_id', 'score_one',
    'score_two', 'home_score', 'away_score', 'scheduled_at', 'played_at',
    'created_at', 'updated_at',
  ],
  league_matches: [
    'id', 'league_match_id', 'competition_id', 'format', 'round', 'tier',
    'team_a', 'team_b', 'score_a', 'score_b', 'status', 'match_date',
    'batch_label',
  ],
}

const report = {}

for (const [table, columns] of Object.entries(probes)) {
  const { data, error, count } = await supabase
    .from(table)
    .select(columns, { count: 'exact' })
    .limit(50)

  report[table] = error
    ? { available: false, error: error.message }
    : { available: true, count, rows: data }
}

const openApiResponse = await fetch(`${url}/rest/v1/`, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/openapi+json',
  },
})

if (openApiResponse.ok) {
  const openApi = await openApiResponse.json()
  const definitions = openApi.definitions ?? openApi.components?.schemas ?? {}
  report.schema = Object.fromEntries(
    Object.keys(probes).map((table) => [
      table,
      Object.keys(definitions[table]?.properties ?? {}),
    ])
  )
} else {
  report.schema = { error: `OpenAPI request failed with ${openApiResponse.status}.` }
}

if (process.argv.includes('--columns')) {
  const columns = {}
  for (const [table, candidates] of Object.entries(columnCandidates)) {
    const available = []
    for (const candidate of candidates) {
      const { error } = await supabase.from(table).select(candidate).limit(1)
      if (!error) available.push(candidate)
    }
    columns[table] = available
  }
  console.log(JSON.stringify(columns, null, 2))
  process.exit(0)
}

if (process.argv.includes('--graphql')) {
  const response = await fetch(`${url}/graphql/v1`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'query SchemaAudit { __schema { types { name fields { name } inputFields { name } } } }',
    }),
  })
  const payload = await response.json()
  const types = payload.data?.__schema?.types ?? []
  const relevant = types.filter((type) => /playoff|bracket|league.*match/i.test(type.name))
  console.log(JSON.stringify({ status: response.status, errors: payload.errors, types: relevant }, null, 2))
  process.exit(0)
}

console.log(JSON.stringify(
  process.argv.includes('--schema') ? report.schema : report,
  null,
  2
))
