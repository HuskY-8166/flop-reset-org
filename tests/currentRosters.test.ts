import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { archivedRosterForCompetitionEntry, buildCurrentRosterContexts, rosterForCompetitionEntry } from '../lib/currentRosters.ts'

const fallSeason = [{ season_id: 2, status: 'upcoming', season_year: 2026 }]
const competitions = [
  { id: 3, season_id: 2, format: '2v2', status: 'upcoming' },
  { id: 4, season_id: 2, format: '3v3', status: 'upcoming' },
]
const teams = [
  { id: 1, name: 'Fracture', format: '3v3', active: true, players: [{ name: 'Historical Player' }] },
  { id: 3, name: 'Frameshift', format: '3v3', active: true, players: [{ name: 'droll' }] },
  { id: 5, name: 'Fracture', format: '2v2', active: true, players: [{ name: 'Repti' }] },
  { id: 6, name: 'Future', format: '3v3', active: true, players: [] },
  { id: 2, name: 'Frantic', format: '3v3', active: false, players: [{ name: 'Waycey' }] },
]
const entries = [
  { entry_id: 161, competition_id: 3, fr_team_id: 5 },
  { entry_id: 162, competition_id: 4, fr_team_id: 1 },
  { entry_id: 163, competition_id: 4, fr_team_id: 3 },
  { entry_id: 164, competition_id: 4, fr_team_id: 6 },
]
const fallRoster = [
  { roster_member_id: 900, entry_id: 163, display_name_snapshot: 'Verified Fall Player', role: 'captain', is_current: true },
]

const current = buildCurrentRosterContexts({ teams, seasons: fallSeason, competitions, entries, members: fallRoster })
assert.deepEqual(current.get(1)?.members, [], 'historical global memberships never fill an empty Fall roster')
assert.deepEqual(current.get(5)?.members, [], '2v2 current roster stays empty without a Fall snapshot')
assert.deepEqual(current.get(3)?.members.map((member) => member.display_name_snapshot), ['Verified Fall Player'], 'current cards display only the Fall competition roster')
assert.deepEqual(current.get(6)?.members, [], 'Future remains empty until a Fall roster is inserted')
assert.equal(current.has(2), false, 'inactive Frantic is excluded from current roster contexts')
assert.deepEqual(teams.find((team) => team.id === 2)?.players, [{ name: 'Waycey' }], 'Frantic historical membership remains unchanged')

const summerRoster = [{ roster_member_id: 500, entry_id: 122, display_name_snapshot: 'Summer Player', role: 'player', is_current: false }]
assert.deepEqual(rosterForCompetitionEntry(122, summerRoster), [], 'closed memberships are not presented as current rosters')
assert.deepEqual(archivedRosterForCompetitionEntry(122, summerRoster).map((member) => member.display_name_snapshot), ['Summer Player'], 'historical Summer views retain their competition roster even after membership closes')
assert.match(
  readFileSync(fileURLToPath(new URL('../app/competitions/archive/[slug]/page.tsx', import.meta.url)), 'utf8'),
  /public_competition_roster_members/,
  'historical Summer archive continues to use competition-specific roster snapshots',
)

console.log('Current-season roster isolation tests passed.')
