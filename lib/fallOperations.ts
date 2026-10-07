import type { SeasonCompetitionLike, SeasonGroup } from './seasons'

function normalized(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('en-US').replace(/[\s-]+/g, '_')
}

function statusPriority(value: unknown) {
  const status = normalized(value)
  if (status === 'active' || status === 'regular_season' || status === 'playoffs') return 2
  if (status === 'upcoming') return 1
  return 0
}

export function selectOperationalSeason<T extends SeasonCompetitionLike>(groups: SeasonGroup<T>[]) {
  return [...groups]
    .filter((group) => statusPriority(group.status) > 0)
    .sort((a, b) =>
      statusPriority(b.status) - statusPriority(a.status)
      || Number(b.year || 0) - Number(a.year || 0)
      || Number(b.seasonId ?? 0) - Number(a.seasonId ?? 0)
    )[0] ?? null
}

export function operationalCompetitionIds<T extends SeasonCompetitionLike>(season: SeasonGroup<T> | null | undefined) {
  return new Set((season?.competitions ?? []).map((competition) => Number(competition.id)).filter(Number.isFinite))
}

export function selectOperationalCompetition<T extends SeasonCompetitionLike>(season: SeasonGroup<T> | null | undefined, format?: string) {
  const matching = (season?.competitions ?? []).filter((competition) => !format || competition.format === format)
  return [...matching].sort((a, b) =>
    statusPriority(b.current_stage ?? b.status) - statusPriority(a.current_stage ?? a.status)
    || String(a.format ?? '').localeCompare(String(b.format ?? ''))
    || Number(b.id ?? 0) - Number(a.id ?? 0)
  )[0] ?? null
}

export function rowsForCompetitionIds<T extends { competition_id?: number | string | null }>(rows: T[], competitionIds: Set<number>) {
  return rows.filter((row) => competitionIds.has(Number(row.competition_id)))
}

export function rowsForMatchCompetitionIds<T extends { matches?: { competition_id?: number | string | null } | Array<{ competition_id?: number | string | null }> | null }>(rows: T[], competitionIds: Set<number>) {
  return rows.filter((row) => {
    const match = Array.isArray(row.matches) ? row.matches[0] : row.matches
    return competitionIds.has(Number(match?.competition_id))
  })
}

export function lifecycleLabel(status: unknown) {
  const value = normalized(status)
  if (value === 'active' || value === 'regular_season' || value === 'playoffs') return 'Live now'
  if (value === 'upcoming') return 'Opening week ready'
  if (value === 'completed' || value === 'archived') return 'Completed'
  return 'Recorded'
}
