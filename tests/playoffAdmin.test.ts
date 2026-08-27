import assert from 'node:assert/strict'
import {
  advancingParticipant,
  getCanonicalPlayoffRound,
  getNextPlayoffMatchOrder,
  getPlayoffRoundOrder,
  getPlayoffTierNumber,
  participantDestinationPatch,
  validatePlayoffMatch,
  type EditablePlayoffMatch,
} from '../lib/playoffAdmin.ts'

assert.equal(getPlayoffRoundOrder('Opening Round'), 1)
assert.equal(getPlayoffRoundOrder('Quarterfinal'), 2)
assert.equal(getPlayoffRoundOrder('Semifinal'), 3)
assert.equal(getPlayoffRoundOrder('Final'), 4)
assert.equal(getPlayoffRoundOrder('3rd Place'), 4)
assert.equal(getPlayoffRoundOrder('All'), null)
assert.equal(getPlayoffRoundOrder('Mystery stage'), null)
assert.equal(getCanonicalPlayoffRound('Quarterfinals'), 'Quarterfinal')
assert.equal(getCanonicalPlayoffRound('Third Place'), '3rd Place')

const orderRows = [
  { round_name: 'Quarterfinal', match_order: 1 },
  { round_name: 'Quarterfinal', match_order: 3 },
  { round_name: 'Semifinal', match_order: 8 },
]
assert.equal(getNextPlayoffMatchOrder(orderRows, 'Quarterfinal'), 4)
assert.equal(getNextPlayoffMatchOrder(orderRows, 'Quarterfinals'), 4)
assert.equal(getNextPlayoffMatchOrder(orderRows, 'Semifinal'), 9)
assert.equal(getNextPlayoffMatchOrder(orderRows, 'Final'), 1)
assert.equal(getNextPlayoffMatchOrder(orderRows, 'All'), null)
assert.equal(getNextPlayoffMatchOrder([{ round_name: 'Final', match_order: null }], 'Final'), null)

assert.equal(getPlayoffTierNumber(6), 6)
assert.equal(getPlayoffTierNumber('Tier 5'), 5)
assert.equal(getPlayoffTierNumber('The Rivalry - Summer Circuit 2026 - T6 Bracket'), 6)
assert.equal(getPlayoffTierNumber(null, 'Summer Tier 4 Playoffs'), 4)
assert.equal(getPlayoffTierNumber('Tier TBD'), null)

const base: EditablePlayoffMatch = {
  roundName: 'Semifinal',
  matchOrder: 1,
  participantA: { kind: 'team', identityId: 1, snapshot: 'Flop Reset | Fracture' },
  participantB: { kind: 'opponent', identityId: 22, snapshot: 'NBDA Neon' },
  scoreA: 3,
  scoreB: 1,
  bestOf: 5,
  scheduledAt: '2026-08-29T20:00',
  status: 'completed',
  winnerSide: 'a',
  isBye: false,
  isForfeit: false,
  seriesId: null,
  scheduledMatchId: null,
  notes: '',
  nextMatchId: 4,
  nextSlot: 1,
  loserNextMatchId: 5,
  loserNextSlot: 2,
}

assert.deepEqual(validatePlayoffMatch(base), [])
assert.equal(advancingParticipant(base, 'winner')?.snapshot, 'Flop Reset | Fracture')
assert.equal(advancingParticipant(base, 'loser')?.snapshot, 'NBDA Neon')
assert.deepEqual(participantDestinationPatch(base.participantA, 2), {
  team_b_name: 'Flop Reset | Fracture',
  flop_reset_team_b_id: 1,
  opponent_b_id: null,
  competition_entry_b_id: null,
})

const bye: EditablePlayoffMatch = {
  ...base,
  participantB: { kind: 'tbd', identityId: null, snapshot: '' },
  scoreA: null,
  scoreB: null,
  bestOf: null,
  winnerSide: 'a',
  isBye: true,
  nextMatchId: 4,
  loserNextMatchId: null,
  loserNextSlot: null,
}
assert.deepEqual(validatePlayoffMatch(bye), [])

const badWinner = { ...base, winnerSide: 'b' as const }
assert.ok(validatePlayoffMatch(badWinner).some((error) => error.includes('Winner does not agree')))

const linked = {
  ...base,
  scoreA: null,
  scoreB: null,
  winnerSide: null,
  seriesId: 123,
}
assert.deepEqual(validatePlayoffMatch(linked, 1), [])
assert.ok(validatePlayoffMatch(linked, 99).some((error) => error.includes('linked series team')))

const forfeit = {
  ...base,
  scoreA: null,
  scoreB: null,
  winnerSide: 'a' as const,
  isForfeit: true,
}
assert.deepEqual(validatePlayoffMatch(forfeit), [])

console.log('Playoff Admin validation tests passed.')
