export const COMPETITION_PHASES = [
  'regular_season',
  'playoffs',
  'qualifier',
  'scrim',
  'exhibition',
] as const

export type CompetitionPhase = (typeof COMPETITION_PHASES)[number]
export type CompetitivePhaseFilter = 'all' | 'regular_season' | 'playoffs'

export function isCompetitionPhase(value: unknown): value is CompetitionPhase {
  return COMPETITION_PHASES.includes(String(value ?? '') as CompetitionPhase)
}

export function normalizeCompetitionPhase(value: unknown): CompetitionPhase | null {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return isCompetitionPhase(normalized) ? normalized : null
}

export function phaseMatchesFilter(value: unknown, filter: CompetitivePhaseFilter) {
  const phase = normalizeCompetitionPhase(value)
  if (filter === 'all') return phase !== 'scrim' && phase !== 'exhibition'
  return phase === filter
}

export function phaseLabel(value: CompetitivePhaseFilter | CompetitionPhase | null | undefined) {
  if (value === 'all') return 'All Competitive'
  if (value === 'regular_season') return 'Regular Season'
  if (value === 'playoffs') return 'Playoffs'
  if (value === 'qualifier') return 'Qualifier'
  if (value === 'scrim') return 'Scrim'
  if (value === 'exhibition') return 'Exhibition'
  return 'Phase Unresolved'
}

export function phaseIsPowerEvidence(value: unknown) {
  const phase = normalizeCompetitionPhase(value)
  return phase === 'regular_season' || phase === 'playoffs'
}
