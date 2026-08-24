import assert from 'node:assert/strict'
import { getGameOutcome, getPerformanceScore, getSeriesOutcome } from '../lib/results.ts'
import { competitionRanks } from '../lib/stats.ts'

const forfeitWin = getGameOutcome({
  flop_reset_score: 0,
  opponent_score: 0,
  is_forfeit: true,
  forfeit_result: 'win',
})
assert.equal(forfeitWin.result, 'W')
assert.equal(forfeitWin.displayScore, '0–0')
assert.equal(getPerformanceScore({ is_forfeit: true, forfeit_result: 'win' }), null)

const forfeitLoss = getGameOutcome({
  flop_reset_score: 0,
  opponent_score: 0,
  is_forfeit: true,
  forfeit_result: 'loss',
})
assert.equal(forfeitLoss.result, 'L')

const legacyForfeit = getGameOutcome({
  flop_reset_score: 1,
  opponent_score: 0,
  is_forfeit: true,
})
assert.equal(legacyForfeit.result, 'W')
assert.equal(legacyForfeit.displayScore, '0–0')

const series = getSeriesOutcome([
  { flop_reset_score: 2, opponent_score: 1 },
  { flop_reset_score: 3, opponent_score: 2 },
  { flop_reset_score: 0, opponent_score: 0, is_forfeit: true, forfeit_result: 'win' },
])
assert.equal(series.result, 'W')
assert.equal(series.displayRecord, '3–0')
assert.equal(series.forfeits, 1)

const ranks = competitionRanks(
  [{ value: 9 }, { value: 8 }, { value: 8 }, { value: 5 }],
  (entry) => String(entry.value),
)
assert.deepEqual(ranks.map((entry) => entry.rank), [1, 2, 2, 4])

console.log('Domain result tests passed.')
