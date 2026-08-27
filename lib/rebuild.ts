export type RebuildCounts = {
  series: number
  matches: number
  playerStats: number
  leagueMatches: number
  forfeits: number
  playedGames: number
  replayIds: number
  teamsRepresented: number
  advancedRows: number
}

export type RebuildReadiness = {
  competitionMismatches: number
  playerAliasesValid: boolean
  opponentAliasesValid: boolean
  structuralTablesValid: boolean
  foreignKeyPlanComplete: boolean
  unidentifiedCascades: number
}

export function isReadyForControlledReset(readiness: RebuildReadiness) {
  return readiness.competitionMismatches === 0 &&
    readiness.playerAliasesValid &&
    readiness.opponentAliasesValid &&
    readiness.structuralTablesValid &&
    readiness.foreignKeyPlanComplete &&
    readiness.unidentifiedCascades === 0
}

export function rebuildProgressLabel(importedSeries: number, expectedSeries?: number | null) {
  return expectedSeries && expectedSeries > 0
    ? `${importedSeries} / ${expectedSeries} verified source series imported`
    : `${importedSeries} verified source series imported · source manifest total not supplied`
}

type ResetFixture = {
  structural: Record<string, unknown[]>
  competitive: {
    series: Array<{ series_id: number }>
    matches: Array<{ match_id: number; series_id: number | null }>
    playerStats: Array<{ stat_id: number; match_id: number }>
    leagueMatches: Array<{ id: number }>
    ratingSnapshots: Array<{ snapshot_id: number; match_id: number | null }>
  }
  playoffMatches: Array<{
    playoff_match_id: number
    series_id: number | null
    status?: string | null
    score_a?: number | null
    score_b?: number | null
    slot1_score?: number | null
    slot2_score?: number | null
    winner_name?: string | null
    winner_side?: 'a' | 'b' | null
    is_forfeit?: boolean | null
  }>
}

/**
 * In-memory mirror of the guarded SQL plan. Used by tests only; production
 * deletion remains a manual Supabase SQL operation.
 */
export function simulateCompetitiveReset(fixture: ResetFixture) {
  const deletedSeries = new Set(fixture.competitive.series.map((row) => row.series_id))
  const playoffMatches = fixture.playoffMatches.map((row) => deletedSeries.has(Number(row.series_id))
    ? {
        ...row,
        series_id: null,
        status: row.status === 'completed' ? 'pending' : row.status,
        score_a: null,
        score_b: null,
        slot1_score: null,
        slot2_score: null,
        winner_name: null,
        winner_side: null,
        is_forfeit: false,
      }
    : { ...row })

  return {
    structural: fixture.structural,
    competitive: {
      series: [],
      matches: [],
      playerStats: [],
      leagueMatches: [],
      ratingSnapshots: [],
    },
    playoffMatches,
  }
}
