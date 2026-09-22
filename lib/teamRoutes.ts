export type TeamRouteIdentity = { id: number | string }

export function teamHref(team: TeamRouteIdentity): string {
  return `/teams/${encodeURIComponent(String(team.id))}`
}

export function parseTeamId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
