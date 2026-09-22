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

export type SeasonStatus = 'upcoming' | 'active' | 'completed' | 'archived' | 'recorded'

export type SeasonLike = {
  season_id?: number | string | null
  league_name?: string | null
  season_name?: string | null
  season_year?: number | string | null
  slug?: string | null
  status?: string | null
  starts_at?: string | null
  ends_at?: string | null
  summary?: string | null
}

export type SeasonCompetitionLike = CompetitionLike & {
  season_id?: number | string | null
  current_stage?: string | null
}

export type SeasonGroup<T extends SeasonCompetitionLike = SeasonCompetitionLike> = {
  key: string
  seasonId: number | null
  slug: string
  league: string
  name: string
  year: string
  status: SeasonStatus
  startsAt: string | null
  endsAt: string | null
  summary: string | null
  competitions: T[]
}

export function archiveSlug(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function seasonSlug(competition: CompetitionLike) {
  const identity = competitionIdentity(competition)
  return archiveSlug([identity.league, identity.circuit, identity.year].filter(Boolean).join(' '))
}

export function normalizeSeasonStatus(value: unknown): SeasonStatus | null {
  const normalized = String(value ?? '').trim().toLocaleLowerCase('en-US').replace(/[\s-]+/g, '_')
  if (normalized === 'upcoming' || normalized === 'active' || normalized === 'completed' || normalized === 'archived' || normalized === 'recorded') return normalized
  if (normalized === 'regular_season' || normalized === 'playoffs' || normalized === 'in_progress') return 'active'
  return null
}

export function deriveSeasonStatus(competitions: SeasonCompetitionLike[], explicitStatus?: unknown): SeasonStatus {
  const explicit = normalizeSeasonStatus(explicitStatus)
  if (explicit) return explicit

  const statuses = competitions
    .flatMap((competition) => [normalizeSeasonStatus(competition.current_stage), normalizeSeasonStatus(competition.status)])
    .filter((status): status is SeasonStatus => Boolean(status))

  if (statuses.length && statuses.every((status) => status === 'completed' || status === 'archived')) return 'completed'
  if (statuses.some((status) => status === 'active')) return 'active'
  if (statuses.length && statuses.every((status) => status === 'upcoming')) return 'upcoming'
  return 'recorded'
}

export function groupCompetitionsBySeason<T extends SeasonCompetitionLike>(
  competitions: T[],
  seasons: SeasonLike[] = [],
): SeasonGroup<T>[] {
  const seasonsById = new Map(
    seasons
      .filter((season) => Number.isFinite(Number(season.season_id)))
      .map((season) => [Number(season.season_id), season]),
  )
  const grouped = new Map<string, SeasonGroup<T>>()

  for (const competition of competitions) {
    const numericSeasonId = Number(competition.season_id)
    const attachedSeason = Number.isFinite(numericSeasonId) ? seasonsById.get(numericSeasonId) : undefined
    const identity = competitionIdentity(competition)
    const league = attachedSeason?.league_name?.trim() || identity.league
    const name = attachedSeason?.season_name?.trim() || identity.circuit
    const year = String(attachedSeason?.season_year ?? identity.year ?? '').trim()
    const slug = attachedSeason?.slug?.trim() || seasonSlug(competition)
    const key = attachedSeason ? `season:${numericSeasonId}` : `legacy:${archiveSlug(`${league}|${name}|${year}`)}`
    const existing = grouped.get(key)

    if (existing) {
      existing.competitions.push(competition)
      existing.status = deriveSeasonStatus(existing.competitions, attachedSeason?.status)
      continue
    }

    grouped.set(key, {
      key,
      seasonId: attachedSeason ? numericSeasonId : null,
      slug,
      league,
      name,
      year,
      status: deriveSeasonStatus([competition], attachedSeason?.status),
      startsAt: attachedSeason?.starts_at ?? null,
      endsAt: attachedSeason?.ends_at ?? null,
      summary: attachedSeason?.summary ?? null,
      competitions: [competition],
    })
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      competitions: [...group.competitions].sort((a, b) => String(a.format ?? '').localeCompare(String(b.format ?? ''))),
    }))
    .sort((a, b) => b.year.localeCompare(a.year, undefined, { numeric: true }) || a.name.localeCompare(b.name))
}
