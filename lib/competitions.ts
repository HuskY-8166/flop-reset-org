import { getCompetitionSummaryCore } from './competitionSummaryCore'
import { getSeriesOutcome, type GameLike } from './results'

export type CompetitionLike = {
  id?: number | string | null
  name?: string | null
  format?: string | null
  host?: string | null
  league_name?: string | null
  circuit_name?: string | null
  season_year?: number | string | null
  year?: number | string | null
  status?: string | null
  start_date?: string | null
}

export type CompetitionSeriesLike = {
  series_id?: number | string | null
  opponent_name?: string | null
  is_bye?: boolean | null
  notes?: string | null
  is_forfeit?: boolean | null
  forfeit_result?: string | null
  result_override?: string | null
  teams?: { name?: string | null; format?: string | null } | Array<{ name?: string | null; format?: string | null }> | null
  matches?: GameLike[] | null
}

export type CompetitionScheduleLike = {
  status?: string | null
  teams?: { name?: string | null; format?: string | null } | Array<{ name?: string | null; format?: string | null }> | null
}

export type CompetitionIntegrityProblem = {
  seriesId: number | string | null
  competitionFormat: string | null
  teamFormat: string | null
  team: string | null
  opponent: string | null
}

export function competitionIdentity(competition: CompetitionLike) {
  const rawName = competition.name?.trim() || 'Competition'
  const encodedLeague = rawName.split(/\s+[—-]\s+/)[0]?.trim()
  const league = competition.league_name?.trim() || competition.host?.trim() || encodedLeague || rawName
  const circuit = competition.circuit_name?.trim() || (league.toLowerCase() === 'the rivalry' ? 'Summer Circuit' : 'Main Event')
  const inferredYear = competition.start_date?.slice(0, 4)
  const year = String(competition.season_year ?? competition.year ?? inferredYear ?? (league.toLowerCase() === 'the rivalry' ? 2026 : '')).trim()

  return {
    league,
    circuit,
    year,
    format: competition.format?.trim() || 'Format TBD',
    status: competition.status?.trim() || 'recorded',
    displayName: `${league} — ${circuit}`,
    seasonLabel: `${circuit}${year ? ` ${year}` : ''}`,
    groupKey: `${league.toLowerCase()}|${circuit.toLowerCase()}|${year}`,
  }
}

export function formatCompetitionAdminLabel(competition: CompetitionLike) {
  const identity = competitionIdentity(competition)
  return `${identity.displayName}${identity.year ? ` ${identity.year}` : ''} · ${identity.format}`
}

export function formatsMatch(competitionFormat: string | null | undefined, teamFormat: string | null | undefined) {
  return Boolean(competitionFormat && teamFormat && competitionFormat === teamFormat)
}

/**
 * Canonical competition totals. Pages should filter rows by competition ID,
 * then pass them here instead of independently rebuilding record logic.
 *
 * A normal or forfeited series is official only when it has a decisive series
 * result. Forfeits count toward series W/L through getSeriesOutcome(), but
 * never toward played-game totals. BYEs and format mismatches count as neither.
 */
export function getCompetitionSummary({
  competition,
  series,
  scheduledMatches = [],
}: {
  competition: CompetitionLike
  series: CompetitionSeriesLike[]
  scheduledMatches?: CompetitionScheduleLike[]
}) {
  return getCompetitionSummaryCore({
    competitionFormat: competition.format,
    series,
    scheduledMatches,
    getOutcome: (matches, row) => getSeriesOutcome(matches as GameLike[], row),
  })
}
