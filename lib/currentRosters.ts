export type CurrentRosterTeam = {
  id: number | string
  format?: string | null
  active?: boolean | null
  players?: unknown
}

export type CurrentRosterSeason = {
  season_id: number | string
  status?: string | null
  season_year?: number | string | null
  starts_at?: string | null
}

export type CurrentRosterCompetition = {
  id: number | string
  season_id?: number | string | null
  format?: string | null
  status?: string | null
  current_stage?: string | null
  start_date?: string | null
}

export type CurrentRosterEntry = {
  entry_id: number | string
  competition_id: number | string
  fr_team_id?: number | string | null
  registration_status?: string | null
  status?: string | null
}

export type CurrentRosterMember = {
  roster_member_id?: number | string
  entry_id: number | string
  display_name_snapshot: string
  role?: string | null
  is_current?: boolean | null
  status?: string | null
  league_player_slug?: string | null
  league_player_display_name?: string | null
}

export type CurrentRosterContext = {
  competitionId: number | null
  entryId: number | null
  members: CurrentRosterMember[]
}

function normalized(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('en-US').replace(/[\s-]+/g, '_')
}

function liveStatus(value: unknown) {
  const status = normalized(value)
  return status === 'active' || status === 'upcoming' || status === 'regular_season' || status === 'playoffs'
}

function statusPriority(value: unknown) {
  const status = normalized(value)
  if (status === 'active' || status === 'regular_season' || status === 'playoffs') return 2
  if (status === 'upcoming') return 1
  return 0
}

function numeric(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function dateValue(value: unknown) {
  const timestamp = Date.parse(String(value ?? ''))
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function selectCurrentSeason(seasons: CurrentRosterSeason[]) {
  return [...seasons]
    .filter((season) => liveStatus(season.status))
    .sort((a, b) =>
      statusPriority(b.status) - statusPriority(a.status)
      || Number(b.season_year ?? 0) - Number(a.season_year ?? 0)
      || dateValue(b.starts_at) - dateValue(a.starts_at)
      || Number(b.season_id) - Number(a.season_id)
    )[0] ?? null
}

export function rosterForCompetitionEntry(entryId: number | string | null | undefined, members: CurrentRosterMember[]) {
  const numericEntryId = numeric(entryId)
  if (numericEntryId === null) return []
  return members.filter((member) =>
    numeric(member.entry_id) === numericEntryId
    && member.is_current !== false
    && normalized(member.status) !== 'removed'
  )
}

export function archivedRosterForCompetitionEntry(entryId: number | string | null | undefined, members: CurrentRosterMember[]) {
  const numericEntryId = numeric(entryId)
  if (numericEntryId === null) return []
  return members.filter((member) => numeric(member.entry_id) === numericEntryId)
}

export function buildCurrentRosterContexts({
  teams,
  seasons,
  competitions,
  entries,
  members,
}: {
  teams: CurrentRosterTeam[]
  seasons: CurrentRosterSeason[]
  competitions: CurrentRosterCompetition[]
  entries: CurrentRosterEntry[]
  members: CurrentRosterMember[]
}) {
  const contexts = new Map<number, CurrentRosterContext>()
  const currentSeason = selectCurrentSeason(seasons)
  const currentSeasonId = numeric(currentSeason?.season_id)

  for (const team of teams.filter((candidate) => candidate.active !== false)) {
    const teamId = numeric(team.id)
    if (teamId === null) continue
    const format = String(team.format ?? '')
    const competition = currentSeasonId === null ? null : [...competitions]
      .filter((candidate) =>
        numeric(candidate.season_id) === currentSeasonId
        && candidate.format === format
        && (liveStatus(candidate.status) || liveStatus(candidate.current_stage))
      )
      .sort((a, b) =>
        statusPriority(b.current_stage ?? b.status) - statusPriority(a.current_stage ?? a.status)
        || dateValue(b.start_date) - dateValue(a.start_date)
        || Number(b.id) - Number(a.id)
      )[0] ?? null
    const competitionId = numeric(competition?.id)
    const entry = competitionId === null ? null : entries.find((candidate) =>
      numeric(candidate.competition_id) === competitionId
      && numeric(candidate.fr_team_id) === teamId
      && normalized(candidate.registration_status) !== 'withdrawn'
      && normalized(candidate.status) !== 'withdrawn'
    ) ?? null
    const entryId = numeric(entry?.entry_id)
    contexts.set(teamId, {
      competitionId,
      entryId,
      members: rosterForCompetitionEntry(entryId, members),
    })
  }

  return contexts
}
