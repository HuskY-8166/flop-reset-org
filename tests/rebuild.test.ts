import assert from 'node:assert/strict'
import {
  isReadyForControlledReset,
  rebuildProgressLabel,
  simulateCompetitiveReset,
} from '../lib/rebuild.ts'

assert.equal(isReadyForControlledReset({
  competitionMismatches: 0,
  playerAliasesValid: true,
  opponentAliasesValid: true,
  structuralTablesValid: true,
  foreignKeyPlanComplete: true,
  unidentifiedCascades: 0,
}), true)

assert.equal(isReadyForControlledReset({
  competitionMismatches: 1,
  playerAliasesValid: true,
  opponentAliasesValid: true,
  structuralTablesValid: true,
  foreignKeyPlanComplete: true,
  unidentifiedCascades: 0,
}), false)

assert.equal(rebuildProgressLabel(3), '3 verified source series imported · source manifest total not supplied')
assert.equal(rebuildProgressLabel(3, 15), '3 / 15 verified source series imported')

const reset = simulateCompetitiveReset({
  structural: {
    teams: [{ id: 1 }],
    players: [{ player_id: 7 }],
    competitions: [{ id: 2 }],
    scheduledMatches: [{ scheduled_id: 4 }],
  },
  competitive: {
    series: [{ series_id: 10 }],
    matches: [{ match_id: 20, series_id: 10 }],
    playerStats: [{ stat_id: 30, match_id: 20 }],
    leagueMatches: [{ id: 40 }],
    ratingSnapshots: [{ snapshot_id: 50, match_id: 40 }],
  },
  playoffMatches: [
    { playoff_match_id: 60, series_id: 10, status: 'completed', score_a: 3, score_b: 1, slot1_score: 3, slot2_score: 1, winner_name: 'Fracture', winner_side: 'a', is_forfeit: true },
    { playoff_match_id: 61, series_id: null, status: 'completed', score_a: 4, score_b: 2, slot1_score: 4, slot2_score: 2, winner_name: 'External Team', winner_side: 'a', is_forfeit: false },
  ],
})

assert.deepEqual(reset.competitive, {
  series: [], matches: [], playerStats: [], leagueMatches: [], ratingSnapshots: [],
})
assert.deepEqual(reset.structural.teams, [{ id: 1 }])
assert.deepEqual(reset.structural.scheduledMatches, [{ scheduled_id: 4 }])
assert.deepEqual(reset.playoffMatches[0], {
  playoff_match_id: 60,
  series_id: null,
  status: 'pending',
  score_a: null,
  score_b: null,
  slot1_score: null,
  slot2_score: null,
  winner_name: null,
  winner_side: null,
  is_forfeit: false,
})
assert.deepEqual(reset.playoffMatches[1], {
  playoff_match_id: 61,
  series_id: null,
  status: 'completed',
  score_a: 4,
  score_b: 2,
  slot1_score: 4,
  slot2_score: 2,
  winner_name: 'External Team',
  winner_side: 'a',
  is_forfeit: false,
})

console.log('Competitive rebuild plan tests passed.')
