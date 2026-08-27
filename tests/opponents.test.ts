import assert from 'node:assert/strict'
import { buildOpponentIdentityIndex } from '../lib/opponents.ts'

const index = buildOpponentIdentityIndex(
  [
    { opponent_id: 9, canonical_name: 'Ohio Midlads' },
    { opponent_id: 7, canonical_name: 'SBC Blue Angels' },
  ],
  [
    { opponent_id: 9, alias: 'MIDLADS', normalized_alias: 'midlads' },
    { opponent_id: 7, alias: 'SBC Angels', normalized_alias: 'sbc angels' },
  ],
)

assert.equal(index.find('MIDLADS')?.canonicalName, 'Ohio Midlads')
assert.equal(index.resolve({ opponentId: 9, snapshotName: 'MIDLADS' })?.canonicalName, 'Ohio Midlads')
assert.equal(index.find('SBC Angels')?.canonicalName, 'SBC Blue Angels')
assert.deepEqual(index.find('Ohio Midlads')?.aliases, ['MIDLADS'])

console.log('Opponent identity tests passed.')
