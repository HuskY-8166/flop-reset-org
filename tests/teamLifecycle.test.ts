import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { brandingForTeam } from '../lib/teamBranding.ts'
import { partitionTeams } from '../lib/teamLifecycle.ts'
import { teamHref } from '../lib/teamRoutes.ts'

const future = {
  id: 41,
  name: 'Future',
  format: '3v3',
  active: true,
  primary_color: '#FF00A6',
  secondary_color: '#BCBAB7',
  brand_metadata: { supporting_color: '#FFFFFF' },
}
const frantic = { id: 7, name: 'Frantic', format: '3v3', active: false }
const fracture = { id: 3, name: 'Fracture', format: '3v3', active: true }

const lifecycle = partitionTeams([frantic, future, fracture])
assert.deepEqual(lifecycle.current.map((team) => team.name), ['Future', 'Fracture'])
assert.deepEqual(lifecycle.historical.map((team) => team.name), ['Frantic'])
const currentTeamIds = new Set(lifecycle.current.map((team) => team.id))
const summerEntries = [
  { fr_team_id: frantic.id, display_name_snapshot: 'Flop Reset - Frantic' },
  { fr_team_id: fracture.id, display_name_snapshot: 'Flop Reset - Fracture' },
]
assert.deepEqual(
  summerEntries.filter((entry) => currentTeamIds.has(entry.fr_team_id)).map((entry) => entry.display_name_snapshot),
  ['Flop Reset - Fracture'],
  'current-context widgets must not revive a historical team through an old competition entry'
)
assert.equal(teamHref(future), '/teams/41')
assert.equal(teamHref(frantic), '/teams/7')
assert.notEqual(teamHref(future), teamHref(frantic), 'Future must never reuse the Frantic route')

const futureBrand = brandingForTeam(future)
assert.equal(futureBrand.primaryColor, '#FF00A6')
assert.equal(futureBrand.secondaryColor, '#BCBAB7')
assert.equal(futureBrand.metadata.supporting_color, '#FFFFFF')

const migration = readFileSync(
  fileURLToPath(new URL('../supabase/manual/202609290022_future_current_team.sql', import.meta.url)),
  'utf8'
)
assert.match(migration, /update public\.teams[\s\S]*active = false[\s\S]*lower\(name\) = 'frantic'/i)
assert.match(migration, /insert into public\.teams[\s\S]*'Future'[\s\S]*'3v3'/)
assert.match(migration, /if exists \(select 1 from public\.series where flop_reset_team_id = future_id\)/)
assert.doesNotMatch(migration, /delete\s+from\s+public\.teams/i)
assert.doesNotMatch(migration, /update\s+public\.series/i)
assert.doesNotMatch(migration, /update\s+public\.matches/i)

console.log('Current and historical team lifecycle tests passed.')
