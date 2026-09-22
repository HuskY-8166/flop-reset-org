export const PLAYOFF_MATCH_STATUSES = ['tbd', 'scheduled', 'live', 'final'] as const

export type PlayoffMatchStatus = (typeof PLAYOFF_MATCH_STATUSES)[number]

export function isPlayoffMatchStatus(value: unknown): value is PlayoffMatchStatus {
  return PLAYOFF_MATCH_STATUSES.includes(value as PlayoffMatchStatus)
}

export function isFinalPlayoffMatch(value: unknown): boolean {
  return value === 'final'
}
