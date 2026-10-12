import assert from 'node:assert/strict'
import { buildOpponentIdentityIndex, resolveImportOpponent } from '../lib/opponents.ts'

const index = buildOpponentIdentityIndex(
  [
    { opponent_id: 9, canonical_name: 'Ohio Midlads' },
    { opponent_id: 7, canonical_name: 'SBC Blue Angels' },
    { opponent_id: 3, canonical_name: 'KUNGFU TREACHERY' },
  ],
  [
    { opponent_id: 9, alias: 'MIDLADS', normalized_alias: 'midlads' },
    { opponent_id: 7, alias: 'SBC Angels', normalized_alias: 'sbc angels' },
    { opponent_id: 3, alias: 'TREACHERY', normalized_alias: 'treachery' },
  ],
)

assert.equal(index.find('MIDLADS')?.canonicalName, 'Ohio Midlads')
assert.equal(index.resolve({ opponentId: 9, snapshotName: 'MIDLADS' })?.canonicalName, 'Ohio Midlads')
assert.equal(index.find('SBC Angels')?.canonicalName, 'SBC Blue Angels')
assert.deepEqual(index.find('Ohio Midlads')?.aliases, ['MIDLADS'])
assert.equal(index.find('TREACHERY')?.opponentId, 3)
assert.equal(
  index.find('TREACHERY')?.opponentId,
  index.resolve({ opponentId: 3, snapshotName: 'Kung-Fu Treachery' })?.opponentId,
)

const naeReaper = { opponentId: 31, canonicalName: 'NAE Reaper', aliases: [] }
const linkedMismatch = resolveImportOpponent({
  csvOpponentName: 'NAE REAPERS',
  csvIdentity: null,
  fixtureLinked: true,
  fixtureIdentity: naeReaper,
})
assert.deepEqual(linkedMismatch.errors, [], 'a verified linked fixture makes a CSV display-name mismatch non-blocking')
assert.equal(linkedMismatch.opponentId, 31)
assert.equal(linkedMismatch.canonicalName, 'NAE Reaper')
assert.deepEqual(linkedMismatch.warnings, [
  'CSV opponent "NAE REAPERS" differs from fixture opponent "NAE Reaper". Fixture identity will be used.',
])

const linkedMatch = resolveImportOpponent({
  csvOpponentName: 'NAE Reaper',
  csvIdentity: naeReaper,
  fixtureLinked: true,
  fixtureIdentity: naeReaper,
})
assert.deepEqual(linkedMatch.errors, [], 'an exact linked-fixture opponent remains importable')
assert.deepEqual(linkedMatch.warnings, [], 'an exact linked-fixture opponent does not produce a warning')

const unlinkedUnresolved = resolveImportOpponent({
  csvOpponentName: 'Unknown Reapers',
  csvIdentity: null,
  fixtureLinked: false,
  fixtureIdentity: null,
})
assert.deepEqual(
  unlinkedUnresolved.errors,
  ['Opponent identity is unresolved. Resolve it in League Directory before import.'],
  'an unlinked unresolved opponent remains fail-closed',
)

const ambiguousIndex = buildOpponentIdentityIndex(
  [
    { opponent_id: 31, canonical_name: 'NAE Reaper' },
    { opponent_id: 32, canonical_name: 'Reaper Academy' },
  ],
  [
    { opponent_id: 31, alias: 'REAPERS' },
    { opponent_id: 32, alias: 'REAPERS' },
  ],
)
assert.equal(ambiguousIndex.find('REAPERS'), null, 'ambiguous unlinked aliases fail closed')

assert.deepEqual(
  { opponentId: linkedMismatch.opponentId, canonicalName: linkedMismatch.canonicalName },
  { opponentId: 31, canonicalName: 'NAE Reaper' },
  'a CSV mismatch reuses the fixture identity and never proposes a duplicate opponent',
)

console.log('Opponent identity tests passed.')
