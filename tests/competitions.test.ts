import assert from 'node:assert/strict'
import { getCompetitionSummaryCore } from '../lib/competitionSummaryCore.ts'
import { getSeriesOutcome } from '../lib/results.ts'

const competition = { id: 2, name: 'Summer Circuit', format: '3v3' }
const summary = getCompetitionSummaryCore({
  competitionFormat: competition.format,
  series: [
    {
      series_id: 1,
      opponent_name: 'Normal',
      teams: { name: 'Frameshift', format: '3v3' },
      matches: [
        { flop_reset_score: 2, opponent_score: 1 },
        { flop_reset_score: 0, opponent_score: 1 },
        { flop_reset_score: 3, opponent_score: 2 },
      ],
    },
    {
      series_id: 2,
      opponent_name: 'Administrative',
      teams: { name: 'Frantic', format: '3v3' },
      matches: [{ is_forfeit: true, result_override: 'win', flop_reset_score: 0, opponent_score: 0 }],
    },
    {
      series_id: 3,
      opponent_name: 'BYE',
      teams: { name: 'Fracture', format: '3v3' },
      matches: [],
    },
    {
      series_id: 4,
      opponent_name: 'Wrong pool',
      teams: { name: 'Fracture', format: '2v2' },
      matches: [{ flop_reset_score: 5, opponent_score: 0 }],
    },
  ],
  scheduledMatches: [
    { status: 'scheduled', teams: { name: 'Fracture', format: '3v3' } },
    { status: 'completed', teams: { name: 'Frameshift', format: '3v3' } },
    { status: 'scheduled', teams: { name: 'Fracture', format: '2v2' } },
  ],
  getOutcome: (matches) => getSeriesOutcome(matches as Parameters<typeof getSeriesOutcome>[0]),
})

assert.equal(summary.officialSeries.length, 2)
assert.equal(summary.seriesWins, 2)
assert.equal(summary.seriesLosses, 0)
assert.equal(summary.playedGames, 3)
assert.equal(summary.gameWins, 2)
assert.equal(summary.gameLosses, 1)
assert.deepEqual(summary.participatingFlopResetTeams, ['Frameshift', 'Frantic'])
assert.equal(summary.upcomingMatches.length, 1)
assert.equal(summary.integrityProblems.length, 1)

console.log('Competition summary tests passed.')
