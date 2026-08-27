type TeamRelation = { name?: string | null; format?: string | null } | Array<{ name?: string | null; format?: string | null }> | null

type SummarySeries = {
  series_id?: number | string | null
  opponent_name?: string | null
  is_bye?: boolean | null
  teams?: TeamRelation
  matches?: unknown[] | null
  is_forfeit?: boolean | null
  forfeit_result?: string | null
  result_override?: string | null
  notes?: string | null
}

type SummarySchedule = {
  status?: string | null
  teams?: TeamRelation
}

type Outcome = {
  won: boolean
  lost: boolean
  playedGames: number
  wins: number
  losses: number
}

function teamOf(row: SummarySeries | SummarySchedule) {
  return Array.isArray(row.teams) ? row.teams[0] : row.teams
}

function sameFormat(competitionFormat: string | null | undefined, teamFormat: string | null | undefined) {
  return Boolean(competitionFormat && teamFormat && competitionFormat === teamFormat)
}

export function getCompetitionSummaryCore<TSeries extends SummarySeries, TSchedule extends SummarySchedule>({
  competitionFormat,
  series,
  scheduledMatches,
  getOutcome,
}: {
  competitionFormat: string | null | undefined
  series: TSeries[]
  scheduledMatches: TSchedule[]
  getOutcome: (matches: unknown[], series: TSeries) => Outcome
}) {
  const integrityProblems: Array<{
    seriesId: number | string | null
    competitionFormat: string | null
    teamFormat: string | null
    team: string | null
    opponent: string | null
  }> = []
  const validSeries: TSeries[] = []

  for (const row of series) {
    const team = teamOf(row)
    if (!sameFormat(competitionFormat, team?.format)) {
      integrityProblems.push({
        seriesId: row.series_id ?? null,
        competitionFormat: competitionFormat ?? null,
        teamFormat: team?.format ?? null,
        team: team?.name ?? null,
        opponent: row.opponent_name ?? null,
      })
      continue
    }
    if (!row.is_bye && row.opponent_name?.trim().toLocaleLowerCase('en-US') !== 'bye') validSeries.push(row)
  }

  let seriesWins = 0
  let seriesLosses = 0
  let playedGames = 0
  let gameWins = 0
  let gameLosses = 0
  const officialSeries: TSeries[] = []

  for (const row of validSeries) {
    const outcome = getOutcome(row.matches ?? [], row)
    if (!outcome.won && !outcome.lost) continue
    officialSeries.push(row)
    playedGames += outcome.playedGames
    gameWins += outcome.wins
    gameLosses += outcome.losses
    if (outcome.won) seriesWins += 1
    else seriesLosses += 1
  }

  const participatingFlopResetTeams = [...new Set(
    officialSeries.map((row) => teamOf(row)?.name).filter((name): name is string => Boolean(name)),
  )]
  const upcomingMatches = scheduledMatches.filter((row) =>
    (row.status === undefined || row.status === null || row.status === 'scheduled') &&
    sameFormat(competitionFormat, teamOf(row)?.format),
  )

  return {
    officialSeries,
    seriesWins,
    seriesLosses,
    playedGames,
    gameWins,
    gameLosses,
    participatingFlopResetTeams,
    upcomingMatches,
    integrityProblems,
  }
}
