import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getCompetitionSummaryCore } from '../lib/competitionSummaryCore.ts'
import { rowsForCompetitionIds, rowsForMatchCompetitionIds } from '../lib/fallOperations.ts'
import { getSeriesOutcome, type GameLike, type SeriesResultLike } from '../lib/results.ts'

function summarize(format: string, series: typeof allSeries, scheduledMatches: Array<{ status: string; teams: { name: string; format: string } }> = []) {
  return getCompetitionSummaryCore({
    competitionFormat: format,
    series,
    scheduledMatches,
    getOutcome: (matches, row) => getSeriesOutcome(matches as GameLike[], row as SeriesResultLike),
  })
}

const summerSeries = {
  series_id: 40,
  competition_id: 2,
  teams: { id: 1, name: 'Fracture', format: '3v3' },
  matches: [
    { flop_reset_score: 3, opponent_score: 1 },
    { flop_reset_score: 2, opponent_score: 0 },
    { flop_reset_score: 4, opponent_score: 2 },
  ],
}
const fallWin = {
  series_id: 90,
  competition_id: 4,
  teams: { id: 1, name: 'Fracture', format: '3v3' },
  matches: [
    { flop_reset_score: 2, opponent_score: 1 },
    { flop_reset_score: 3, opponent_score: 2 },
    { flop_reset_score: 1, opponent_score: 0 },
  ],
}
const fallTwoVersusTwo = {
  series_id: 91,
  competition_id: 3,
  teams: { id: 5, name: 'Fracture', format: '2v2' },
  matches: [
    { flop_reset_score: 0, opponent_score: 1 },
    { flop_reset_score: 1, opponent_score: 2 },
    { flop_reset_score: 2, opponent_score: 3 },
  ],
}

const fall3v3 = new Set([4])
const summer3v3 = new Set([2])
const allSeries = [summerSeries, fallWin, fallTwoVersusTwo]
const emptyFall = rowsForCompetitionIds([summerSeries], fall3v3)
const emptyFallSummary = summarize('3v3', emptyFall)
assert.equal(emptyFallSummary.seriesWins, 0, 'Summer history plus zero Fall results renders a 0–0 current record')
assert.equal(emptyFallSummary.seriesLosses, 0)

const fallSummary = summarize('3v3', rowsForCompetitionIds(allSeries, fall3v3))
assert.equal(fallSummary.seriesWins, 1, 'one Fall win renders a 1–0 current record')
assert.equal(fallSummary.seriesLosses, 0)

const summerSummary = summarize('3v3', rowsForCompetitionIds(allSeries, summer3v3))
assert.equal(summerSummary.seriesWins, 1, 'Fall results do not alter the Summer archive record')
assert.equal(summerSummary.seriesLosses, 0)
assert.deepEqual(rowsForCompetitionIds(allSeries, fall3v3).map((row) => row.series_id), [90], '2v2 and 3v3 results remain isolated')

const playerStats = [
  { stat_id: 1, goals: 4, matches: { competition_id: 2 } },
  { stat_id: 2, goals: 1, matches: { competition_id: 4 } },
]
assert.deepEqual(rowsForMatchCompetitionIds(playerStats, fall3v3).map((row) => row.stat_id), [2], 'current leaders cannot fall back to historical player stats')
assert.deepEqual(rowsForMatchCompetitionIds([playerStats[0]], fall3v3), [], 'empty Fall leaders remain empty when only Summer stats exist')

const scheduledOnly = summarize('3v3', [], [{ status: 'scheduled', teams: { name: 'Future', format: '3v3' } }])
assert.equal(scheduledOnly.seriesWins, 0, 'a scheduled fixture never counts as a completed result')
assert.equal(scheduledOnly.seriesLosses, 0)
assert.equal(scheduledOnly.upcomingMatches.length, 1)

const homeSource = readFileSync(fileURLToPath(new URL('../app/page.tsx', import.meta.url)), 'utf8')
assert.doesNotMatch(homeSource, /rowsForCompetitionIds\(upcoming\?\?\[\],operationalIds\)\.slice/, 'the current schedule total is not truncated to the homepage display count')
const uiSource = readFileSync(fileURLToPath(new URL('../components/ui.tsx', import.meta.url)), 'utf8')
assert.match(uiSource, /unplayed = wins === 0 && losses === 0/, 'an unplayed 0–0 record renders without a misleading tie label')

console.log('Current-season integrity tests passed.')
