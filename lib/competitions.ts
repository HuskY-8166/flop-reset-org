import { getCompetitionSummaryCore } from './competitionSummaryCore'
import { getSeriesOutcome, type GameLike } from './results'
import type { CompetitionLike } from './seasons'

export { competitionIdentity, formatCompetitionAdminLabel, formatsMatch } from './seasons'
export type { CompetitionLike } from './seasons'

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
