import type { CompetitionPhase } from './competitionPhase'

export const SCHEDULE_STATUSES = ['scheduled', 'postponed', 'cancelled', 'completed'] as const
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number]

export type ScheduleIdentity = {
  competitionId: number
  competitionEntryId: number
  teamId: number
  opponentId: number
  matchDate: string
  scheduledLocalTime?: string | null
  timezone: string
  phase: CompetitionPhase
  sourceProvider?: string | null
  sourceExternalId?: string | null
}

export type ScheduleConflictRow = ScheduleIdentity & {
  scheduledId: number
}

function clean(value: unknown) {
  return String(value ?? '').trim()
}

export function scheduleSourceKey(value: Pick<ScheduleIdentity, 'competitionId' | 'sourceProvider' | 'sourceExternalId'>) {
  const provider = clean(value.sourceProvider).toLocaleLowerCase('en-US')
  const externalId = clean(value.sourceExternalId)
  return provider && externalId ? `${value.competitionId}|${provider}|${externalId}` : null
}

export function scheduleTupleKey(value: ScheduleIdentity) {
  return [
    value.competitionId,
    value.competitionEntryId,
    value.teamId,
    value.opponentId,
    clean(value.matchDate),
    value.phase,
  ].join('|')
}

export function validateScheduleIdentity(value: Partial<ScheduleIdentity>) {
  const errors: string[] = []
  if (!Number.isInteger(value.competitionId) || Number(value.competitionId) <= 0) errors.push('Choose a competition.')
  if (!Number.isInteger(value.competitionEntryId) || Number(value.competitionEntryId) <= 0) errors.push('Choose a verified competition entry.')
  if (!Number.isInteger(value.teamId) || Number(value.teamId) <= 0) errors.push('Choose a canonical Flop Reset team.')
  if (!Number.isInteger(value.opponentId) || Number(value.opponentId) <= 0) errors.push('Choose a verified canonical opponent.')
  if (!clean(value.matchDate)) errors.push('Enter the verified match date.')
  if (!clean(value.timezone)) errors.push('Enter the source timezone.')
  if (value.phase !== 'regular_season' && value.phase !== 'playoffs') errors.push('Choose a verified competition phase.')
  const provider = clean(value.sourceProvider)
  const externalId = clean(value.sourceExternalId)
  if (!provider && externalId) errors.push('A source provider is required when a stable match ID is supplied.')
  return errors
}

export function findScheduleConflict(existing: ScheduleConflictRow[], candidate: ScheduleIdentity) {
  const candidateSource = scheduleSourceKey(candidate)
  const candidateTuple = scheduleTupleKey(candidate)
  for (const row of existing) {
    const sameSource = candidateSource && scheduleSourceKey(row) === candidateSource
    const sameTuple = scheduleTupleKey(row) === candidateTuple
    if (sameSource || sameTuple) {
      return {
        scheduledId: row.scheduledId,
        kind: sameTuple ? 'duplicate' as const : 'conflict' as const,
        reason: sameTuple
          ? 'This exact fixture is already scheduled.'
          : 'The stable source match ID already points to a different fixture tuple.',
      }
    }
  }
  return null
}

export function schedulePhaseLabel(value: unknown) {
  return value === 'playoffs' ? 'Playoffs' : 'Regular Season'
}
