import assert from 'node:assert/strict'
import {
  lifecycleLabel,
  operationalCompetitionIds,
  rowsForCompetitionIds,
  selectOperationalCompetition,
  selectOperationalSeason,
} from '../lib/fallOperations.ts'

const summer = {
  key: 'season:1', seasonId: 1, slug: 'summer', league: 'The Rivalry', name: 'Summer Circuit', year: '2026',
  status: 'completed' as const, startsAt: null, endsAt: null, summary: null,
  competitions: [{ id: 1, format: '2v2', status: 'completed' }, { id: 2, format: '3v3', status: 'completed' }],
}
const fall = {
  key: 'season:2', seasonId: 2, slug: 'fall', league: 'The Rivalry', name: 'Fall Circuit', year: '2026',
  status: 'upcoming' as const, startsAt: null, endsAt: null, summary: null,
  competitions: [{ id: 3, format: '2v2', status: 'upcoming' }, { id: 4, format: '3v3', status: 'upcoming' }],
}

const operational = selectOperationalSeason([summer, fall])
assert.equal(operational?.seasonId, 2, 'an upcoming Fall season is the current operating context, not completed Summer')
assert.equal(selectOperationalCompetition(operational, '3v3')?.id, 4)
assert.deepEqual([...operationalCompetitionIds(operational)], [3, 4])
assert.deepEqual(rowsForCompetitionIds([{ competition_id: 2 }, { competition_id: 3 }, { competition_id: 4 }], new Set([3, 4])), [{ competition_id: 3 }, { competition_id: 4 }])
assert.equal(lifecycleLabel('upcoming'), 'Opening week ready')
assert.equal(lifecycleLabel('regular_season'), 'Live now')

console.log('Fall operations tests passed.')
