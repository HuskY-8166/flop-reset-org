import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) throw new Error('Supabase environment is not configured.')

const supabase = createClient(url, key, { auth: { persistSession: false } })

async function rows(table, columns = '*') {
  const { data, error } = await supabase.from(table).select(columns)
  if (error) throw new Error(`${table}: ${error.message}`)
  return data ?? []
}

const [competitions, teams, series, matches, stats, scheduled] = await Promise.all([
  rows('competitions'),
  rows('teams'),
  rows('series'),
  rows('matches'),
  rows('match_player_stats', 'stat_id, match_id, player_id, players ( name )'),
  rows('scheduled_matches'),
])

const competitionById = new Map(competitions.map((row) => [Number(row.id), row]))
const teamById = new Map(teams.map((row) => [Number(row.id), row]))
const matchesBySeries = new Map()
const statsByMatch = new Map()

for (const match of matches) {
  const key = Number(match.series_id)
  matchesBySeries.set(key, [...(matchesBySeries.get(key) ?? []), match])
}
for (const stat of stats) {
  const key = Number(stat.match_id)
  statsByMatch.set(key, [...(statsByMatch.get(key) ?? []), stat])
}

const seriesAudit = series
  .map((row) => {
    const competition = competitionById.get(Number(row.competition_id))
    const team = teamById.get(Number(row.flop_reset_team_id))
    const games = matchesBySeries.get(Number(row.series_id)) ?? []
    const forfeitGames = games.filter((game) => game.is_forfeit).length
    const playerStatRows = games.reduce((total, game) => total + (statsByMatch.get(Number(game.match_id))?.length ?? 0), 0)
    return {
      series_id: row.series_id,
      series_date: row.series_date,
      competition_id: row.competition_id,
      competition_name: competition?.name ?? null,
      competition_format: competition?.format ?? null,
      flop_reset_team_id: row.flop_reset_team_id,
      team_name: team?.name ?? null,
      team_format: team?.format ?? null,
      opponent: row.opponent_name,
      best_of: row.best_of,
      game_count: games.length,
      forfeit_status: forfeitGames === 0 ? 'none' : forfeitGames === games.length ? 'all' : 'mixed',
      forfeit_games: forfeitGames,
      player_stat_rows: playerStatRows,
      notes: row.notes ?? null,
      format_mismatch: Boolean(competition?.format && team?.format && competition.format !== team.format),
      games: games.map((game) => ({
        match_id: game.match_id,
        match_date: game.match_date,
        score: `${game.flop_reset_score}-${game.opponent_score}`,
        is_forfeit: Boolean(game.is_forfeit),
        round: game.round ?? null,
        replay_id: game.replay_id ?? null,
        player_stat_rows: statsByMatch.get(Number(game.match_id))?.length ?? 0,
      })),
    }
  })
  .sort((a, b) => Number(a.series_id) - Number(b.series_id))

const competitionAudit = competitions.map((competition) => {
  const competitionSeries = seriesAudit.filter((row) => Number(row.competition_id) === Number(competition.id))
  const dates = competitionSeries.flatMap((row) => [row.series_date, ...row.games.map((game) => game.match_date)]).filter(Boolean).sort()
  return {
    id: competition.id,
    name: competition.name,
    format: competition.format,
    host: competition.host ?? null,
    metadata: competition,
    series_count: competitionSeries.length,
    game_count: competitionSeries.reduce((total, row) => total + row.game_count, 0),
    player_stat_rows: competitionSeries.reduce((total, row) => total + row.player_stat_rows, 0),
    teams: [...new Set(competitionSeries.map((row) => `${row.team_name} (${row.team_format})`))],
    earliest_date: dates[0] ?? null,
    latest_date: dates.at(-1) ?? null,
    format_mismatches: competitionSeries.filter((row) => row.format_mismatch).length,
    scheduled_count: scheduled.filter((row) => Number(row.competition_id) === Number(competition.id)).length,
  }
})

const matchMismatches = matches.flatMap((match) => {
  const competition = competitionById.get(Number(match.competition_id))
  const team = teamById.get(Number(match.flop_reset_team_id))
  return competition?.format && team?.format && competition.format !== team.format
    ? [{ match_id: match.match_id, competition_id: match.competition_id, competition_format: competition.format, team_id: match.flop_reset_team_id, team_name: team.name, team_format: team.format }]
    : []
})

const scheduledMismatches = scheduled.flatMap((match) => {
  const competition = competitionById.get(Number(match.competition_id))
  const team = teamById.get(Number(match.flop_reset_team_id))
  return competition?.format && team?.format && competition.format !== team.format
    ? [{ scheduled_id: match.scheduled_id, competition_id: match.competition_id, competition_format: competition.format, team_id: match.flop_reset_team_id, team_name: team.name, team_format: team.format }]
    : []
})

const audit = {
  generated_at: new Date().toISOString(),
  row_counts: { competitions: competitions.length, teams: teams.length, series: series.length, matches: matches.length, match_player_stats: stats.length, scheduled_matches: scheduled.length },
  competitions: competitionAudit,
  series: seriesAudit,
  format_mismatches: seriesAudit.filter((row) => row.format_mismatch),
  match_format_mismatches: matchMismatches,
  scheduled_format_mismatches: scheduledMismatches,
  scheduled_matches: scheduled.map((row) => ({
    scheduled_id: row.scheduled_id,
    competition_id: row.competition_id,
    team_id: row.flop_reset_team_id,
    team_name: teamById.get(Number(row.flop_reset_team_id))?.name ?? null,
    team_format: teamById.get(Number(row.flop_reset_team_id))?.format ?? null,
    opponent: row.opponent_name,
    match_date: row.match_date,
    status: row.status,
  })),
}

if (process.argv.includes('--summary')) {
  console.log(JSON.stringify({
    generated_at: audit.generated_at,
    row_counts: audit.row_counts,
    competitions: audit.competitions,
    series: audit.series.map((row) => Object.fromEntries(
      Object.entries(row).filter(([key]) => key !== 'games')
    )),
    match_format_mismatch_count: audit.match_format_mismatches.length,
    scheduled_format_mismatches: audit.scheduled_format_mismatches,
    scheduled_matches: audit.scheduled_matches,
  }, null, 2))
} else {
  console.log(JSON.stringify(audit, null, 2))
}
