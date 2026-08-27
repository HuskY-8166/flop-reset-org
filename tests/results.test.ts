import assert from 'node:assert/strict'
import { countsAsPlayedGame, getGameOutcome, getPerformanceScore, getSeriesOutcome } from '../lib/results.ts'
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
assert.equal(countsAsPlayedGame({ flop_reset_score: 0, opponent_score: 0, is_forfeit: true }), false)

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
assert.equal(legacyForfeit.result, 'T')
assert.equal(legacyForfeit.hasExplicitResult, false)
assert.equal(legacyForfeit.displayScore, '0–0')

const missingScore = getGameOutcome({
  flop_reset_score: null,
  opponent_score: null,
})
assert.equal(missingScore.displayScore, '—')
assert.equal(missingScore.performanceScore, null)
assert.equal(countsAsPlayedGame({ flop_reset_score: null, opponent_score: null }), false)
assert.equal(countsAsPlayedGame({ flop_reset_score: 3, opponent_score: 2 }), true)

const series = getSeriesOutcome([
  { flop_reset_score: 2, opponent_score: 1 },
  { flop_reset_score: 3, opponent_score: 2 },
  { flop_reset_score: 0, opponent_score: 0, is_forfeit: true, forfeit_result: 'win' },
])
assert.equal(series.result, 'W')
assert.equal(series.displayRecord, '2–0')
assert.equal(series.forfeits, 1)
assert.equal(series.playedGames, 2)

const pureSeriesForfeit = getSeriesOutcome([
  { flop_reset_score: 0, opponent_score: 0, is_forfeit: true, result_override: 'win' },
])
assert.equal(pureSeriesForfeit.result, 'W')
assert.equal(pureSeriesForfeit.displayRecord, '0–0')
assert.equal(pureSeriesForfeit.playedGames, 0)

const zeroGameForfeit = getSeriesOutcome([], {
  is_forfeit: true,
  result_override: 'loss',
})
assert.equal(zeroGameForfeit.result, 'L')
assert.equal(zeroGameForfeit.forfeits, 1)
assert.equal(zeroGameForfeit.playedGames, 0)
assert.equal(zeroGameForfeit.displayRecord, '0–0')

const legacyZeroGameForfeit = getSeriesOutcome([], { notes: 'Forfeit Win — Round 4' })
assert.equal(legacyZeroGameForfeit.result, 'W')
assert.equal(legacyZeroGameForfeit.playedGames, 0)

const ranks = competitionRanks(
  [{ value: 9 }, { value: 8 }, { value: 8 }, { value: 5 }],
  (entry) => String(entry.value),
)
assert.deepEqual(ranks.map((entry) => entry.rank), [1, 2, 2, 4])

console.log('Domain result tests passed.')
