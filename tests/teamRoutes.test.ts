import assert from 'node:assert/strict'
import { parseTeamId, teamHref } from '../lib/teamRoutes.ts'

const fracture2v2 = { id: 12, name: 'Fracture', format: '2v2' }
const fracture3v3 = { id: 34, name: 'Fracture', format: '3v3' }

assert.equal(teamHref(fracture2v2), '/teams/12')
assert.equal(teamHref(fracture3v3), '/teams/34')
assert.notEqual(teamHref(fracture2v2), teamHref(fracture3v3))
assert.equal(parseTeamId('12'), 12)
assert.equal(parseTeamId('Fracture'), null)

console.log('Stable team identity route tests passed.')
