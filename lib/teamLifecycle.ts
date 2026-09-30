export type TeamLifecycleRow = {
  active?: boolean | null
}

export function isCurrentTeam(team: TeamLifecycleRow) {
  return team.active !== false
}

export function partitionTeams<T extends TeamLifecycleRow>(teams: readonly T[]) {
  return {
    current: teams.filter(isCurrentTeam),
    historical: teams.filter((team) => !isCurrentTeam(team)),
  }
}
