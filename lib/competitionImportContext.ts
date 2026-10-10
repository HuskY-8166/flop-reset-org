export type CompetitionEntryOption = {
  entry_id: number
  competition_id: number
  fr_team_id: number | null
  display_name_snapshot: string
  status?: string | null
  registration_status?: string | null
}

export type ScheduledFixtureOption = {
  scheduled_id: number
  competition_id: number
  competition_entry_id?: number | null
  flop_reset_team_id?: number | null
  competition_phase?: string | null
  status?: string | null
}

export function competitionEntryOptions(
  entries: CompetitionEntryOption[],
  competitionId: number | string,
) {
  return entries.filter((entry) =>
    Number(entry.competition_id) === Number(competitionId) &&
    entry.fr_team_id !== null &&
    entry.fr_team_id !== undefined &&
    Number.isFinite(Number(entry.fr_team_id)) &&
    entry.status !== 'withdrawn' &&
    entry.registration_status !== 'withdrawn',
  )
}

export function scheduledFixturesForEntry<T extends ScheduledFixtureOption>(
  fixtures: T[],
  {
    competitionId,
    entryId,
    canonicalTeamId,
    phase,
  }: {
    competitionId: number | string
    entryId: number | string
    canonicalTeamId: number | string
    phase: string
  },
): T[] {
  return fixtures.filter((fixture) =>
    fixture.status === 'scheduled' &&
    Number(fixture.competition_id) === Number(competitionId) &&
    Number(fixture.competition_entry_id) === Number(entryId) &&
    Number(fixture.flop_reset_team_id) === Number(canonicalTeamId) &&
    fixture.competition_phase === phase,
  )
}
