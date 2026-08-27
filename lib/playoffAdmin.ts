export type ParticipantKind = 'team' | 'opponent' | 'entry' | 'tbd'
export type WinnerSide = 'a' | 'b' | null

export const PLAYOFF_ROUNDS = [
  'Opening Round',
  'Quarterfinal',
  'Semifinal',
  'Final',
  '3rd Place',
] as const

export type PlayoffRoundName = (typeof PLAYOFF_ROUNDS)[number]

export function getCanonicalPlayoffRound(value: string | null | undefined): PlayoffRoundName | null {
  const round = String(value ?? '').trim().toLowerCase()
  if (round === 'opening round' || round === 'round of 16' || round === 'round 1') return 'Opening Round'
  if (round === 'quarterfinal' || round === 'quarterfinals') return 'Quarterfinal'
  if (round === 'semifinal' || round === 'semifinals') return 'Semifinal'
  if (round === 'final' || round === 'finals') return 'Final'
  if (round === '3rd place' || round === 'third place') return '3rd Place'
  return null
}

export function getPlayoffRoundOrder(value: string | null | undefined): number | null {
  const round = getCanonicalPlayoffRound(value)
  if (round === 'Opening Round') return 1
  if (round === 'Quarterfinal') return 2
  if (round === 'Semifinal') return 3
  if (round === 'Final' || round === '3rd Place') return 4
  return null
}

export function getNextPlayoffMatchOrder(
  matches: Array<{ round_name?: unknown; match_order?: unknown }>,
  roundName: string,
): number | null {
  const canonicalRound = getCanonicalPlayoffRound(roundName)
  if (canonicalRound === null) return null

  const orders = matches
    .filter((match) => getCanonicalPlayoffRound(String(match.round_name ?? '')) === canonicalRound)
    .map((match) => Number(match.match_order))

  if (orders.some((order) => !Number.isInteger(order) || order < 1)) return null
  return Math.max(0, ...orders) + 1
}

export function getPlayoffTierNumber(tier: unknown, bracketName?: unknown): number | null {
  for (const value of [tier, bracketName]) {
    const text = String(value ?? '').trim()
    if (!text) continue
    const exact = Number(text)
    if (Number.isInteger(exact) && exact > 0) return exact
    const match = text.match(/(?:^|\b)(?:tier\s*|t)(\d+)(?:\b|$)/i)
    const parsed = Number(match?.[1])
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  }
  return null
}

export type PlayoffParticipant = {
  kind: ParticipantKind
  identityId: number | null
  snapshot: string
  linkedFrTeamId?: number | null
  linkedOpponentId?: number | null
}

export type EditablePlayoffMatch = {
  roundName: string
  matchOrder: number
  participantA: PlayoffParticipant
  participantB: PlayoffParticipant
  scoreA: number | null
  scoreB: number | null
  bestOf: number | null
  scheduledAt: string
  status: 'pending' | 'scheduled' | 'live' | 'completed'
  winnerSide: WinnerSide
  isBye: boolean
  isForfeit: boolean
  seriesId: number | null
  scheduledMatchId: number | null
  notes: string
  nextMatchId: number | null
  nextSlot: number | null
  loserNextMatchId: number | null
  loserNextSlot: number | null
}

export function participantKey(participant: PlayoffParticipant) {
  return participant.kind === 'tbd' ? 'tbd' : `${participant.kind}:${participant.identityId}`
}

export function validatePlayoffMatch(
  match: EditablePlayoffMatch,
  linkedSeriesTeamId?: number | null,
) {
  const errors: string[] = []
  const participants = [match.participantA, match.participantB]

  if (getPlayoffRoundOrder(match.roundName) === null) errors.push('Select a valid playoff round.')
  if (!Number.isInteger(match.matchOrder) || match.matchOrder < 1) errors.push('Match number must be a positive integer.')
  for (const [index, participant] of participants.entries()) {
    if (participant.kind !== 'tbd' && !participant.identityId) errors.push(`Participant ${index + 1} needs a canonical identity.`)
    if (participant.kind !== 'tbd' && !participant.snapshot.trim()) errors.push(`Participant ${index + 1} needs a display-name snapshot.`)
  }
  if (participantKey(match.participantA) !== 'tbd' && participantKey(match.participantA) === participantKey(match.participantB)) {
    errors.push('The same canonical participant cannot occupy both slots.')
  }
  if (match.scoreA !== null && (!Number.isInteger(match.scoreA) || match.scoreA < 0)) errors.push('Score 1 must be a nonnegative integer.')
  if (match.scoreB !== null && (!Number.isInteger(match.scoreB) || match.scoreB < 0)) errors.push('Score 2 must be a nonnegative integer.')
  if ((match.scoreA === null) !== (match.scoreB === null)) errors.push('Enter both scores or leave both blank.')
  if (match.bestOf !== null && (!Number.isInteger(match.bestOf) || match.bestOf < 1 || match.bestOf % 2 === 0)) {
    errors.push('Best-of must be a positive odd number.')
  }
  if (match.bestOf && Math.max(match.scoreA ?? 0, match.scoreB ?? 0) > Math.ceil(match.bestOf / 2)) {
    errors.push('A score exceeds the wins possible for this best-of.')
  }

  if (match.isBye) {
    const known = participants.filter((participant) => participant.kind !== 'tbd')
    if (known.length !== 1) errors.push('A BYE needs exactly one known participant.')
    if (match.seriesId || match.scheduledMatchId) errors.push('A BYE cannot link a series or scheduled match.')
    if (match.scoreA !== null || match.scoreB !== null) errors.push('A BYE cannot have a score.')
    if (match.isForfeit) errors.push('A match cannot be both a BYE and a forfeit.')
    const expectedWinner = match.participantA.kind !== 'tbd' ? 'a' : 'b'
    if (match.winnerSide !== expectedWinner) errors.push('The known BYE participant must be the winner.')
  }

  if (match.isForfeit) {
    if (!match.winnerSide) errors.push('A forfeit needs an explicit winner.')
    if (match.scoreA !== null || match.scoreB !== null) errors.push('Store no competitive score for a forfeit; public display is 0-0.')
  }

  if (match.seriesId) {
    if (linkedSeriesTeamId && !participants.some((participant) =>
      (participant.kind === 'team' && participant.identityId === linkedSeriesTeamId)
      || (participant.kind === 'entry' && participant.linkedFrTeamId === linkedSeriesTeamId)
    )) {
      errors.push('The linked series team does not match either canonical participant.')
    }
    if (match.scoreA !== null || match.scoreB !== null || match.winnerSide || match.isForfeit) {
      errors.push('A linked FR series is the result source of truth; clear local score, winner, and forfeit fields.')
    }
  } else if (!match.isBye && !match.isForfeit && match.scoreA !== null && match.scoreB !== null) {
    const expectedWinner = match.scoreA > match.scoreB ? 'a' : match.scoreB > match.scoreA ? 'b' : null
    if (expectedWinner !== match.winnerSide) errors.push('Winner does not agree with the entered score.')
  }

  if (match.status === 'completed' && !match.winnerSide && !match.seriesId) errors.push('A Final-status match needs a winner.')
  if (match.nextMatchId && ![1, 2].includes(Number(match.nextSlot))) errors.push('Winner destination needs slot 1 or 2.')
  if (match.loserNextMatchId && ![1, 2].includes(Number(match.loserNextSlot))) errors.push('Loser destination needs slot 1 or 2.')

  return [...new Set(errors)]
}

export function advancingParticipant(match: EditablePlayoffMatch, mode: 'winner' | 'loser') {
  if (!match.winnerSide) return null
  const side = mode === 'winner'
    ? match.winnerSide
    : match.winnerSide === 'a' ? 'b' : 'a'
  return side === 'a' ? match.participantA : match.participantB
}

export function participantDestinationPatch(participant: PlayoffParticipant, slot: 1 | 2) {
  const suffix = slot === 1 ? 'a' : 'b'
  return {
    [`team_${suffix}_name`]: participant.snapshot || null,
    [`flop_reset_team_${suffix}_id`]: participant.kind === 'team' ? participant.identityId : null,
    [`opponent_${suffix}_id`]: participant.kind === 'opponent' ? participant.identityId : null,
    [`competition_entry_${suffix}_id`]: participant.kind === 'entry' ? participant.identityId : null,
  }
}
