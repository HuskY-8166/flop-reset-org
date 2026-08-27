import assert from 'node:assert/strict'
import {
  detectBallchasingFile,
  getBasicStatConflicts,
  getPlayersCsvCoverage,
  mapPlayersCsvRow,
  nonNullUpdate,
  numberOrNull,
} from '../lib/ballchasingImport.ts'

const playersHeaders = [
  'team name', 'player name', 'games', 'goals', 'assists', 'saves', 'shots', 'score',
  'bpm per game', 'avg speed per game', 'time slow speed per game',
  'time boost speed per game', 'time supersonic speed per game', 'time on ground per game',
  'time low in air per game', 'time high in air per game', 'time defensive half per game',
  'time offensive half per game', 'time defensive third per game', 'time neutral third per game',
  'time offensive third per game', '0 boost time per game',
]
assert.equal(detectBallchasingFile(playersHeaders).type, 'players')
assert.equal(detectBallchasingFile(['replay id', 'player name', 'team name']).type, 'players-games')
assert.equal(numberOrNull('0'), 0)
assert.equal(numberOrNull(''), null)

const mapped = mapPlayersCsvRow({
  'team name': 'FLOP RESET',
  'player name': 'AkTION',
  games: '5', goals: '5', assists: '5', saves: '1', shots: '20', score: '1793',
  'bpm per game': '414.89', 'avg speed per game': '1551.14',
  'time slow speed per game': '143.69', 'time boost speed per game': '161.34',
  'time supersonic speed per game': '40.69', 'time on ground per game': '212.5',
  'time low in air per game': '122.33', 'time high in air per game': '10.9',
  'time defensive half per game': '247.85', 'time offensive half per game': '208.54',
  'time defensive third per game': '137.18', 'time neutral third per game': '156.18',
  'time offensive third per game': '103.78', '0 boost time per game': '0',
})
assert.equal(mapped.games, 5)
assert.equal(mapped.basic.goals, 5)
assert.ok(Number(mapped.tracking.percentage_supersonic_speed) > 0)
assert.equal(mapped.tracking.zero_boost_pct, 0)
assert.deepEqual(getPlayersCsvCoverage([mapped]), {
  total: 5, basic: 5, movement: 5, positioning: 5, zeroBoost: 5,
})

assert.deepEqual(nonNullUpdate({ avg_speed: null, bpm: 0, zero_boost_pct: undefined }), { bpm: 0 })
assert.deepEqual(getBasicStatConflicts(
  { goals: 1, assists: 2, saves: 0, shots: 4, score: 300 },
  { goals: 2, assists: 2, saves: 0, shots: 4, score: 300 },
), [{ field: 'goals', stored: 1, incoming: 2 }])

console.log('Advanced Ballchasing import tests passed.')
