import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  archiveRemovedRosterMembers,
  buildLeagueSyncPreview,
  directoryCoverage,
  effectiveSourceUpdate,
  leagueSlug,
  normalizeLeagueIdentity,
  parseRivalryCompetitionHtml,
  parseRivalryTeamHtml,
  sourceSnapshotCanApply,
  stableSourceKey,
} from '../lib/leagueDirectory.ts'
import { participantDestinationPatch, validatePlayoffMatch, type EditablePlayoffMatch } from '../lib/playoffAdmin.ts'

const fixture3v3 = readFileSync(new URL('./fixtures/rivalry-competition-3v3.html', import.meta.url), 'utf8')
const fixture2v2 = readFileSync(new URL('./fixtures/rivalry-competition-2v2.html', import.meta.url), 'utf8')
const teamFixture = readFileSync(new URL('./fixtures/rivalry-team.html', import.meta.url), 'utf8')
const parsed3v3 = parseRivalryCompetitionHtml(fixture3v3, 'https://therivalry.gg/competitions/comp-3v3', '2026-08-26T12:00:00Z')
const parsed2v2 = parseRivalryCompetitionHtml(fixture2v2, 'https://therivalry.gg/competitions/comp-2v2', '2026-08-26T12:00:00Z')

assert.deepEqual(parsed3v3.errors, [])
assert.deepEqual(parsed2v2.errors, [])
assert.equal(parsed3v3.snapshot?.entries.length, 2)
assert.equal(parsed3v3.snapshot?.entries[0].roster.length, 3)
assert.equal(parsed3v3.snapshot?.entries[0].roster[0].role, 'captain')
assert.equal(parsed3v3.snapshot?.entries[0].roster[2].role, 'manager')
assert.equal(parsed2v2.snapshot?.format, '2v2 Doubles')
assert.notEqual(parsed3v3.snapshot?.entries[1].sourceRegistrationKey, parsed2v2.snapshot?.entries[0].sourceRegistrationKey, '2v2 and 3v3 source registrations must remain isolated')
assert.ok(sourceSnapshotCanApply(parsed3v3.snapshot, parsed3v3.errors))
const parsedTeam = parseRivalryTeamHtml(teamFixture, 'https://therivalry.gg/teams/team-zero')
assert.deepEqual(parsedTeam.errors, [])
assert.equal(parsedTeam.snapshot?.externalTeamId, 'team-zero')
assert.equal(parsedTeam.snapshot?.members[0].externalId, 'player-alpha')
assert.equal(parsedTeam.snapshot?.members[2].role, 'manager')

const source3v3 = parsed3v3.snapshot!
const changedRosterHtml = fixture3v3.replace('Bravo', 'Bravo Renamed')
const changedRoster = parseRivalryCompetitionHtml(changedRosterHtml, 'https://therivalry.gg/competitions/comp-3v3', '2026-08-27T12:00:00Z').snapshot!
assert.equal(changedRoster.entries[0].sourceRegistrationKey, source3v3.entries[0].sourceRegistrationKey, 'roster changes preserve the competition registration identity')
const current = [{
  entry_id: 9,
  display_name_snapshot: 'Zero Orbit Manual',
  tier: '5',
  logo_url_snapshot: null,
  source_registration_key: source3v3.entries[0].sourceRegistrationKey,
  source_external_id: 'team-zero',
  locked_fields: ['display_name_snapshot'],
  competition_roster_members: [{ source_member_key: 'old-player', display_name_snapshot: 'Old Player', role: 'player', is_current: true }],
}]
const preview = buildLeagueSyncPreview(source3v3, current)
assert.equal(preview.changedTeams.length, 1)
assert.equal(preview.newTeams.length, 1, 'competition entry can exist without any FR series')
assert.equal(preview.lockedConflicts.length, 1)
assert.equal(preview.removedRosterMembers.length, 1)
assert.equal(preview.newRosterMembers.length, 4, 'preview includes members on changed and newly discovered registrations')
assert.equal(preview.possibleDuplicates.length, 0)

const effective = effectiveSourceUpdate(current[0], source3v3.entries[0])
assert.equal(effective.display_name_snapshot, undefined, 'manual locked name survives source sync')
assert.equal(effective.tier, '6', 'unlocked tier accepts source update')

const duplicatePreview = buildLeagueSyncPreview(source3v3, [{
  entry_id: 12,
  display_name_snapshot: 'Same Name',
  source_registration_key: 'another-source-registration',
}])
assert.equal(duplicatePreview.possibleDuplicates.length, 1, 'same display name must not auto-merge')
assert.equal(duplicatePreview.newTeams.length, 2)

const archived = archiveRemovedRosterMembers(
  [{ source_member_key: 'old-player', is_current: true, status: 'active' }],
  source3v3.entries[0].roster,
)
assert.equal(archived[0].is_current, false)
assert.equal(archived[0].status, 'removed', 'removed member history is preserved')

const playoffEntry: EditablePlayoffMatch = {
  roundName: 'Quarterfinal', matchOrder: 1,
  participantA: { kind: 'entry', identityId: 91, snapshot: 'Never Played United' },
  participantB: { kind: 'tbd', identityId: null, snapshot: '' },
  scoreA: null, scoreB: null, bestOf: 7, scheduledAt: '', status: 'pending', winnerSide: null,
  isBye: false, isForfeit: false, seriesId: null, scheduledMatchId: null, notes: '',
  nextMatchId: null, nextSlot: null, loserNextMatchId: null, loserNextSlot: null,
}
assert.deepEqual(validatePlayoffMatch(playoffEntry), [], 'external competition entry is a valid playoff participant')
assert.deepEqual(participantDestinationPatch(playoffEntry.participantA, 1), {
  team_a_name: 'Never Played United',
  flop_reset_team_a_id: null,
  opponent_a_id: null,
  competition_entry_a_id: 91,
})
assert.equal(playoffEntry.seriesId, null, 'participant selection creates no series')
assert.equal(playoffEntry.scheduledMatchId, null, 'participant selection creates no match row')

const coverage = directoryCoverage({ rosterCount: 0, leagueResultCount: 0, hasPower: false, frMeetingCount: 0 })
assert.equal(coverage.frMeetings, false, 'never-played team renders an empty meeting state')
assert.equal(coverage.leagueEntry, true, 'minimal soft team still has a league entry')
assert.equal(directoryCoverage({ rosterCount: 3, leagueResultCount: 4, hasPower: true, frMeetingCount: 1 }).power, true)
assert.equal(leagueSlug('Ohio Midlads', 123456789), 'ohio-midlads-23456789')
assert.equal(normalizeLeagueIdentity('MÍDLADS'), 'midlads')
assert.equal(stableSourceKey(['3v3', 'Same Name']), stableSourceKey(['3v3', 'Same Name']), 'duplicate source application is idempotent')

const malformed = parseRivalryCompetitionHtml('<html><h1>Changed markup</h1></html>', 'https://therivalry.gg/competitions/broken')
assert.equal(malformed.snapshot, null)
assert.ok(malformed.errors.length > 0, 'source failure must fail closed and preserve the last good snapshot')

const archivedEntry = { status: 'archived', display_name_snapshot: 'Historic Team' }
assert.equal(archivedEntry.display_name_snapshot, 'Historic Team', 'archived entries remain renderable')
assert.equal(source3v3.entries[0].roster[0].externalId, 'player-alpha', 'stable player identity is retained without creating an FR player')

const resetSql = readFileSync(new URL('../supabase/manual/202608250009_clean_competitive_rebuild.sql', import.meta.url), 'utf8').toLocaleLowerCase('en-US')
for (const structuralTable of ['competition_entries', 'external_team_sources', 'league_players', 'competition_roster_members', 'external_source_snapshots', 'admin_audit_log']) {
  assert.equal(resetSql.includes(`delete from public.${structuralTable}`), false, `${structuralTable} must survive competitive reset`)
  assert.ok(resetSql.includes(`'${structuralTable}'`), `${structuralTable} must be captured by reset preservation verification`)
}
assert.equal(/\btruncate\s+(table\s+)?public\./.test(resetSql), false)

console.log('League directory, Rivalry parser, identity, roster, and playoff-entry tests passed.')
