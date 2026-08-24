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
