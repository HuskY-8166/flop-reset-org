import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { findScheduleConflict, scheduleSourceKey, scheduleTupleKey, validateScheduleIdentity } from '../lib/scheduleOperations.ts'

const fixture = {
  competitionId: 4,
  competitionEntryId: 162,
  teamId: 1,
  opponentId: 50,
  matchDate: '2026-10-08',
  scheduledLocalTime: null,
  timezone: 'America/New_York',
  phase: 'regular_season' as const,
  sourceProvider: 'Rivalry',
  sourceExternalId: 'match-123',
}

assert.deepEqual(validateScheduleIdentity(fixture), [])
assert.match(scheduleSourceKey(fixture) ?? '', /4\|rivalry\|match-123/)
assert.match(scheduleTupleKey(fixture), /4\|162\|1\|50\|2026-10-08\|regular_season/)
assert.equal(findScheduleConflict([{ ...fixture, scheduledId: 90 }], fixture)?.kind, 'duplicate')
assert.equal(findScheduleConflict([{ ...fixture, scheduledId: 90 }], { ...fixture, scheduledLocalTime: '21:00' })?.kind, 'duplicate')
assert.equal(findScheduleConflict([{ ...fixture, scheduledId: 90 }], { ...fixture, sourceExternalId: 'match-124', matchDate: '2026-10-09' }), null)
assert.deepEqual(validateScheduleIdentity({ ...fixture, opponentId: 0 }), ['Choose a verified canonical opponent.'])
assert.deepEqual(validateScheduleIdentity({ ...fixture, sourceExternalId: null }), [])
assert.deepEqual(validateScheduleIdentity({ ...fixture, sourceProvider: null }), ['A source provider is required when a stable match ID is supplied.'])

const migration = readFileSync(fileURLToPath(new URL('../supabase/migrations/202610060019_schedule_operations_foundation.sql', import.meta.url)), 'utf8').toLocaleLowerCase('en-US')
assert.match(migration, /create unique index if not exists scheduled_matches_source_identity_unique/)
assert.match(migration, /create unique index if not exists scheduled_matches_verified_tuple_unique/)
assert.match(migration, /create_verified_scheduled_match/)
assert.match(migration, /set_scheduled_match_local_time/)
assert.match(migration, /scheduled_time_locked/)
assert.match(migration, /scheduled_local_time time/)
assert.match(migration, /case when local_time is null then 'tbd' else 'manual' end/)
assert.match(migration, /owner-managed schedule time is locked/)
assert.doesNotMatch(migration, /verified local time and timezone are required/)
assert.match(migration, /site_admin authorization required/)
assert.match(migration, /alter table public\.series add column if not exists scheduled_match_id/)
assert.doesNotMatch(migration, /insert into public\.(competitions|competition_seasons|team_rating_snapshots)/)

const admin = readFileSync(fileURLToPath(new URL('../app/admin/page.tsx', import.meta.url)), 'utf8')
assert.match(admin, /scheduled_match_id:\s*selectedScheduledMatch/)
assert.match(admin, /create_verified_scheduled_match/)
assert.doesNotMatch(admin, /function markCompleted/)

const publication = readFileSync(fileURLToPath(new URL('../supabase/manual/202610060027_publish_fall_round1_schedule.sql', import.meta.url)), 'utf8')
assert.match(publication, /\(161::bigint, 'Tier 3'::text\)/)
assert.match(publication, /\(166::bigint, 'Tier 6'::text\)/)
assert.match(publication, /'SE Midnight'/)
assert.match(publication, /'Acid Pioneers'/)
assert.match(publication, /scheduled_local_time, scheduled_time_source, scheduled_time_locked/)
assert.match(publication, /null, null, 'tbd', true/)
assert.doesNotMatch(publication, /team_rating_snapshots/)

console.log('Schedule operations tests passed.')
