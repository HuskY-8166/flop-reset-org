import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { identifyReplaySides } from '../lib/importValidation.ts'

const csv = readFileSync(fileURLToPath(new URL('./fixtures/qa-fall-opening-players-games.csv', import.meta.url)), 'utf8').trim().split(/\r?\n/)
const headers = csv[0].split(';')
const rows = csv.slice(1).map((line) => Object.fromEntries(line.split(';').map((value, index) => [headers[index], value])))
const roster = [
  { player_id: -8801, name: 'Comet One', aliases: [] },
  { player_id: -8802, name: 'Comet Two', aliases: [] },
  { player_id: -8803, name: 'Comet Three', aliases: [] },
]
const byReplay = new Map<string, typeof rows>()
for (const row of rows) byReplay.set(row['replay id'], [...(byReplay.get(row['replay id']) ?? []), row])
const results = [...byReplay.entries()].map(([replayId, replayRows]) => ({
  replayId,
  resolution: identifyReplaySides({
    selectedTeam: 'QA Fall Comets',
    format: '3v3',
    roster,
    rows: replayRows.map((row) => ({ rawName: row['player name'], teamName: row['team name'], goals: Number(row.goals) })),
  }),
}))

assert.equal(results.length, 3)
assert.equal(results.every(({ resolution }) => resolution.errors.length === 0), true)
assert.equal(results.every(({ resolution }) => resolution.resolved.length === 3), true)
assert.equal(results.every(({ resolution }) => Number(resolution.ourGoals) > Number(resolution.theirGoals)), true)
assert.equal(results.reduce((sum, { resolution }) => sum + resolution.resolved.length, 0), 9)

const activationSql = readFileSync(fileURLToPath(new URL('../supabase/manual/202610020023_fall_lifecycle_activate.sql', import.meta.url)), 'utf8').toLocaleLowerCase('en-US')
assert.match(activationSql, /where id in \(3,4\)/)
assert.match(activationSql, /set status = 'active', current_stage = 'regular_season'/)
assert.match(activationSql, /before_row jsonb/)
assert.doesNotMatch(activationSql, /insert into public\.(series|matches|match_player_stats|league_matches|team_rating_snapshots)/)

console.log('Synthetic Fall opening-series rehearsal fixture tests passed.')
