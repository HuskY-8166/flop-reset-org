import assert from 'node:assert/strict'
import {
  archiveSlug,
  deriveSeasonStatus,
  groupCompetitionsBySeason,
  normalizeSeasonStatus,
  seasonSlug,
} from '../lib/seasons.ts'

assert.equal(archiveSlug('The Rivalry — Summer Circuit 2026'), 'the-rivalry-summer-circuit-2026')
assert.equal(seasonSlug({ league_name: 'The Rivalry', circuit_name: 'Summer Circuit', season_year: 2026, format: '3v3' }), 'the-rivalry-summer-circuit-2026')
assert.equal(normalizeSeasonStatus('regular season'), 'active')
assert.equal(normalizeSeasonStatus('unknown'), null)
assert.equal(deriveSeasonStatus([{ status: 'completed' }, { current_stage: 'completed' }]), 'completed')
assert.equal(deriveSeasonStatus([{ status: 'completed' }, { current_stage: 'playoffs' }]), 'active')
assert.equal(deriveSeasonStatus([{ status: 'active' }], 'completed'), 'completed')

const grouped = groupCompetitionsBySeason([
  { id: 2, league_name: 'The Rivalry', circuit_name: 'Summer Circuit', season_year: 2026, format: '3v3', current_stage: 'completed' },
  { id: 1, league_name: 'The Rivalry', circuit_name: 'Summer Circuit', season_year: 2026, format: '2v2', status: 'completed' },
  { id: 3, league_name: 'The Rivalry', circuit_name: 'Fall Circuit', season_year: 2026, format: '3v3', status: 'active' },
])

assert.equal(grouped.length, 2)
assert.equal(grouped[0].name, 'Fall Circuit')
assert.equal(grouped[1].slug, 'the-rivalry-summer-circuit-2026')
assert.equal(grouped[1].status, 'completed')
assert.deepEqual(grouped[1].competitions.map((competition) => competition.format), ['2v2', '3v3'])

const attached = groupCompetitionsBySeason([
  { id: 1, season_id: 9, name: 'Legacy label', format: '3v3' },
  { id: 2, season_id: 9, name: 'Another label', format: '2v2' },
], [{ season_id: 9, league_name: 'The Rivalry', season_name: 'Summer Circuit', season_year: 2026, slug: 'summer-2026', status: 'archived' }])

assert.equal(attached.length, 1)
assert.equal(attached[0].seasonId, 9)
assert.equal(attached[0].slug, 'summer-2026')
assert.equal(attached[0].status, 'archived')

console.log('Season grouping and archive identity tests passed.')
