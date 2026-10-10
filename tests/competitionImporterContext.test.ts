import assert from 'node:assert/strict'
import { competitionEntryOptions, scheduledFixturesForEntry } from '../lib/competitionImportContext.ts'
import { resolveCompetitionImportRoster } from '../lib/competitionImportRoster.ts'

const entries = [
  { entry_id: 120, competition_id: 2, fr_team_id: 3, display_name_snapshot: 'Frameshift' },
  { entry_id: 122, competition_id: 2, fr_team_id: 2, display_name_snapshot: 'Frantic' },
  { entry_id: 161, competition_id: 3, fr_team_id: 5, display_name_snapshot: 'FRCS' },
  { entry_id: 166, competition_id: 3, fr_team_id: 8, display_name_snapshot: 'rat summer' },
  { entry_id: 162, competition_id: 4, fr_team_id: 1, display_name_snapshot: 'Fracture' },
  { entry_id: 163, competition_id: 4, fr_team_id: 3, display_name_snapshot: 'Frameshift' },
  { entry_id: 164, competition_id: 4, fr_team_id: 6, display_name_snapshot: 'Future' },
  { entry_id: 165, competition_id: 4, fr_team_id: 7, display_name_snapshot: 'FRCS' },
]

assert.deepEqual(
  competitionEntryOptions(entries, 3).map((entry) => entry.entry_id),
  [161, 166],
  'Fall 2v2 exposes only entries 161 and 166',
)
assert.deepEqual(
  competitionEntryOptions(entries, 4).map((entry) => entry.entry_id),
  [162, 163, 164, 165],
  'Fall 3v3 exposes only entries 162 through 165',
)
assert.equal(
  competitionEntryOptions(entries, 4).some((entry) => entry.display_name_snapshot === 'Frantic'),
  false,
  'historical Frantic is absent from the Fall selector',
)
assert.deepEqual(
  competitionEntryOptions(entries, 2).map((entry) => entry.entry_id),
  [120, 122],
  'historical Summer entries remain available in the Summer importer',
)

const frameshiftRoster = resolveCompetitionImportRoster({
  canonicalTeamId: 3,
  members: [
    { roster_member_id: 8, display_name_snapshot: 'HuskY', league_player_id: null },
    { roster_member_id: 9, display_name_snapshot: 'drollotov', league_player_id: null },
    { roster_member_id: 10, display_name_snapshot: 'scott', league_player_id: 503 },
  ],
  leaguePlayers: [
    { league_player_id: 503, linked_fr_player_id: 12 },
  ],
  teamPlayers: [
    { player_id: 10, name: 'droll', aliases: ['Drollotov'], team_id: 3 },
    { player_id: 11, name: 'HuskY', aliases: ['HuskY.G2'], team_id: 3 },
    { player_id: 12, name: 'scott', aliases: [], team_id: 3 },
    { player_id: 90, name: 'HuskY', aliases: [], team_id: 1 },
  ],
})
assert.deepEqual(
  frameshiftRoster.players.map((player) => [player.name, player.player_id]),
  [['HuskY', 11], ['drollotov', 10], ['scott', 12]],
  'Frameshift loads exactly its Fall competition roster and preserves stored links',
)
assert.deepEqual(frameshiftRoster.unresolved, [])

const seasonIsolation = resolveCompetitionImportRoster({
  canonicalTeamId: 3,
  members: [{ roster_member_id: 200, display_name_snapshot: 'New Fall Player', league_player_id: null }],
  leaguePlayers: [],
  teamPlayers: [
    { player_id: 22, name: 'Summer Player', aliases: ['New Fall Player'], team_id: 2 },
  ],
})
assert.deepEqual(seasonIsolation.players, [], 'another canonical team cannot supply a Fall roster identity')
assert.deepEqual(seasonIsolation.unresolved.map((member) => member.name), ['New Fall Player'])

const fixtures = [
  { scheduled_id: 14, competition_id: 4, competition_entry_id: 163, flop_reset_team_id: 3, competition_phase: 'regular_season', status: 'scheduled' },
  { scheduled_id: 99, competition_id: 4, competition_entry_id: 120, flop_reset_team_id: 3, competition_phase: 'regular_season', status: 'scheduled' },
  { scheduled_id: 100, competition_id: 2, competition_entry_id: 120, flop_reset_team_id: 3, competition_phase: 'regular_season', status: 'scheduled' },
]
assert.deepEqual(
  scheduledFixturesForEntry(fixtures, {
    competitionId: 4,
    entryId: 163,
    canonicalTeamId: 3,
    phase: 'regular_season',
  }).map((fixture) => fixture.scheduled_id),
  [14],
  'fixture lookup is scoped to the exact Fall competition entry',
)

console.log('competition importer context tests passed')
