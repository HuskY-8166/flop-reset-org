import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

const powerCompatibility = read('../supabase/migrations/202609300016_power_foundation_compatibility.sql')
assert.match(powerCompatibility, /begin;/i)
assert.match(powerCompatibility, /commit;/i)
assert.match(powerCompatibility, /create table if not exists public\.team_rating_snapshots/i)
assert.match(powerCompatibility, /model_version text not null/i)
assert.match(powerCompatibility, /team_rating_snapshots_pool_round_idx/i)
assert.match(powerCompatibility, /team_rating_snapshots_team_idx/i)
assert.match(powerCompatibility, /enable row level security/i)
assert.match(powerCompatibility, /site_admin/i)
assert.match(powerCompatibility, /raise exception 'Existing team_rating_snapshots/i)
assert.doesNotMatch(powerCompatibility, /update public\.(series|matches|league_matches|teams)/i)
assert.doesNotMatch(powerCompatibility, /insert into public\.team_rating_snapshots/i)

const summerLifecycle = read('../supabase/manual/202609300017_summer_lifecycle_complete.sql')
assert.match(summerLifecycle, /where id in \(1,2\)/i)
assert.match(summerLifecycle, /set status = 'completed', current_stage = 'completed'/i)
assert.match(summerLifecycle, /summer_lifecycle_competitions_20260930/i)
assert.doesNotMatch(summerLifecycle, /update public\.(series|matches|match_player_stats|league_matches|competition_entries)/i)
assert.doesNotMatch(summerLifecycle, /(final_placement|regular_season_finish|placement_label)\s*=/i)

const summerRollback = read('../supabase/manual/202609300017_summer_lifecycle_complete_rollback.sql')
assert.match(summerRollback, /jsonb_populate_record\(null::public\.competitions/i)
assert.match(summerRollback, /jsonb_populate_record\(null::public\.competition_seasons/i)

const rlsCompatibility = read('../supabase/migrations/202609300018_site_admin_rls_compatibility.sql')
assert.match(rlsCompatibility, /core_write_policies_20260930/i)
assert.match(rlsCompatibility, /site_admin/i)
assert.match(rlsCompatibility, /cmd in \('ALL', 'INSERT', 'UPDATE', 'DELETE'\)/i)
assert.doesNotMatch(rlsCompatibility, /drop policy[\s\S]*for select/i)

const rlsRollback = read('../supabase/manual/202609300018_site_admin_rls_compatibility_rollback.sql')
assert.match(rlsRollback, /create policy %I on public\.%I/i)
assert.match(rlsRollback, /core_write_policies_20260930/i)

console.log('Production cutover compatibility and lifecycle tests passed.')
