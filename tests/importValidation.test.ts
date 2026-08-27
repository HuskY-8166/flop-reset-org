import assert from 'node:assert/strict'
import { expectedPlayersForFormat, identifyReplaySides, resolveRosterIdentity } from '../lib/importValidation.ts'

const roster = [
  { player_id: 9, name: 'aktionrl', aliases: ['AkTION'] },
  { player_id: 10, name: 'droll', aliases: ['Drollotov'] },
  { player_id: 11, name: 'HuskY', aliases: ['HuskY.G2'] },
]

assert.equal(expectedPlayersForFormat('3v3'), 3)
assert.equal(resolveRosterIdentity('AkTION', roster)?.player.name, 'aktionrl')
assert.equal(resolveRosterIdentity('drollotov', roster)?.player.name, 'droll')
assert.equal(resolveRosterIdentity('HUSKY.G2', roster)?.player.name, 'HuskY')
assert.equal(resolveRosterIdentity('unknown', roster), null)

const safe = identifyReplaySides({
  selectedTeam: 'Frameshift',
  format: '3v3',
  roster,
  rows: [
    { rawName: 'AkTION', teamName: 'Frameshift', goals: 1 },
    { rawName: 'Drollotov', teamName: 'Frameshift', goals: 1 },
    { rawName: 'HuskY.G2', teamName: 'Frameshift', goals: 1 },
    { rawName: 'wavey chan xoxo', teamName: 'MIDLADS', goals: 1 },
    { rawName: 'Toilet', teamName: 'MIDLADS', goals: 1 },
    { rawName: 'VarsoDX', teamName: 'MIDLADS', goals: 0 },
  ],
})
assert.deepEqual(safe.errors, [])
assert.equal(safe.resolved.length, 3)
assert.equal(safe.opponentRows.length, 3)
assert.equal(safe.ourGoals, 3)
assert.equal(safe.theirGoals, 2)

const unresolved = identifyReplaySides({
  selectedTeam: 'Frameshift',
  format: '3v3',
  roster,
  rows: [
    { rawName: 'AkTION', teamName: 'Frameshift', goals: 1 },
    { rawName: 'Drollotov', teamName: 'Frameshift', goals: 1 },
    { rawName: 'New Sub', teamName: 'Frameshift', goals: 1 },
    { rawName: 'wavey chan xoxo', teamName: 'MIDLADS', goals: 1 },
    { rawName: 'Toilet', teamName: 'MIDLADS', goals: 1 },
    { rawName: 'VarsoDX', teamName: 'MIDLADS', goals: 0 },
  ],
})
assert.ok(unresolved.errors.some((error) => error.includes('Unresolved Flop Reset players')))
assert.deepEqual(unresolved.unresolvedFrNames, ['New Sub'])
assert.equal(unresolved.opponentPlayerNames.includes('New Sub'), false)
assert.equal(unresolved.ourGoals, 3)

const ambiguous = identifyReplaySides({
  selectedTeam: 'Unknown CSV Label',
  format: '3v3',
  roster,
  rows: [
    { rawName: 'AkTION', teamName: 'Blue', goals: 1 },
    { rawName: 'Drollotov', teamName: 'Blue', goals: 1 },
    { rawName: 'HuskY.G2', teamName: 'Blue', goals: 1 },
    { rawName: 'aktionrl', teamName: 'Orange', goals: 1 },
    { rawName: 'Toilet', teamName: 'Orange', goals: 1 },
    { rawName: 'VarsoDX', teamName: 'Orange', goals: 0 },
  ],
})
assert.ok(ambiguous.errors.some((error) => error.includes('unambiguous')))
assert.equal(ambiguous.ourGoals, null)

console.log('Import validation tests passed.')
