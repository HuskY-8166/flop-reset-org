import assert from 'node:assert/strict'
import { calculateEloWithHistory, RATING_MODEL_VERSION, type LeagueMatch } from '../lib/elo.ts'

function match(overrides: Partial<LeagueMatch>): LeagueMatch {
  return {
    id: overrides.id ?? Math.random(),
    competition_id: 2,
    format: '3v3',
    round: 'Round 1',
    tier: 'Tier 4',
    team_a: 'A',
    team_b: 'B',
    score_a: '3',
    score_b: '2',
    status: 'completed',
    match_date: '2026-08-01',
    ...overrides,
  }
}

assert.equal(RATING_MODEL_VERSION, 'FR-ELO-1.0')

const expectedWin = calculateEloWithHistory([
  match({ id: 1, tier: 'Tier 3', team_a: 'Higher', team_b: 'Seed' }),
  match({ id: 2, round: 'Round 2', tier: 'Tier 3', team_a: 'Higher', team_b: 'Lower' }),
])
const higher = expectedWin.teamSummaries.find((team) => team.team === 'Higher')!

const upset = calculateEloWithHistory([
  match({ id: 3, tier: 'Tier 3', team_a: 'Higher', team_b: 'Seed' }),
  match({ id: 4, round: 'Round 2', tier: 'Tier 3', team_a: 'Lower', team_b: 'Higher' }),
])
const lower = upset.teamSummaries.find((team) => team.team === 'Lower')!
assert.ok(lower.lastRoundDelta > higher.lastRoundDelta, 'An upset should earn more than an expected win.')
assert.equal(lower.giantKillerUpsets, 1)

const seededUpset = calculateEloWithHistory([
  match({ id: 5, tier: 'Tier 3', team_a: 'Elite', team_b: 'Challenger', score_a: '3', score_b: '0' }),
  match({ id: 6, round: 'Round 2', tier: 'Tier 3', team_a: 'Challenger', team_b: 'Elite', score_a: '3', score_b: '2' }),
])
const challenger = seededUpset.teamSummaries.find((team) => team.team === 'Challenger')!
assert.equal(challenger.giantKillerUpsets, 1)
assert.ok(challenger.giantKillerLargestGap > 0)

const forfeit = calculateEloWithHistory([
  match({ id: 7, score_a: 'FFW', score_b: 'FFL' }),
])
assert.equal(forfeit.teamSummaries.find((team) => team.team === 'A')!.giantKillerUpsets, 0)
assert.equal(forfeit.matchHistory.A[0].displayScore, 'W · FORFEIT · 0–0')

const sameRound = calculateEloWithHistory([
  match({ id: 8, team_b: 'B' }),
  match({ id: 9, team_b: 'C', score_a: '1', score_b: '3' }),
])
const aEvents = sameRound.matchHistory.A
const aSummary = sameRound.teamSummaries.find((team) => team.team === 'A')!
assert.ok(Math.abs(aSummary.lastRoundDelta - aEvents.reduce((sum, event) => sum + event.delta, 0)) < 0.000001)

const duplicate = match({ id: 10 })
const deduped = calculateEloWithHistory([duplicate, duplicate])
assert.equal(deduped.duplicateCount, 1)
assert.equal(deduped.matchHistory.A.length, 1)

assert.throws(() => calculateEloWithHistory([
  match({ id: 11, format: '3v3' }),
  match({ id: 12, format: '2v2' }),
]), /multiple formats/i)

assert.throws(() => calculateEloWithHistory([
  match({ id: 13, competition_id: 2 }),
  match({ id: 14, competition_id: 3 }),
]), /multiple competitions/i)

const history = calculateEloWithHistory([
  match({ id: 15, round: 'Round 1', team_a: 'A', team_b: 'B' }),
  match({ id: 16, round: 'Round 2', team_a: 'A', team_b: 'B', score_a: '1', score_b: '3' }),
])
assert.equal(history.teamRoundHistory.A.length, 2)
assert.equal(history.matchHistory.A[1].opponentRatingBefore, history.matchHistory.B[1].ratingBefore)
assert.ok(history.teamSummaries.find((team) => team.team === 'A')!.sosFull > 0)

console.log('Power Engine domain tests passed.')
