# V2.4 Production Cutover Preflight

Prepared: 2026-09-30  
Branch: `v2.4-fall-foundation`  
Commit: `93c5cc50ed6b58082eead9c0e86bef710741da76`  
Production project: `ofjunyubcmzejbnawhul`  
Mode: authenticated read-only catalog/data audit. No migration, deploy, or data write was performed.

## Production schema delta

### Already represented — do not rerun

`202609020012_v24_fall_foundation.sql` is represented in production:

- `series.competition_phase`, default `regular_season`
- `league_matches.competition_phase`, default `regular_season`
- `competitions.current_stage`, default `upcoming`
- all nine V2.4 team lifecycle/brand columns
- all six guarded V2.4 checks from migration 012
- `teams_slug_idx`, phase indexes, and `playoff_matches_series_unique`
- `public.v24_phase_reconciliation`

Production has no `supabase_migrations` schema or migration ledger, so this
determination is based on catalog equivalence rather than recorded versions.

### Missing

- `202609050014_atomic_rivalry_playoff_sync.sql`: the RPC is absent.
- `202609120015_v24_archive_foundation.sql`: `competition_seasons`,
  `season_awards`, `competitions.season_id`, the three placement columns,
  archive indexes/views, archive RLS policies, and archive grants are absent.
- The Power snapshot portion of `202608240005_power_engine_foundation.sql` is
  absent. `team_rating_snapshots` does not exist; only the earlier
  `league_matches.competition_id` column/index exists. Source columns and the
  source-match index from migration 005 are also absent.

Migration 014's required playoff columns all exist. The production status check
is named `playoff_matches_status_check` and is validated for exactly
`tbd | scheduled | live | final`. Migration 015's required competition,
entry, player, and team columns all exist.

## Exact before-image

### Summer competitions

Both rows share `The Rivalry | Summer Circuit | 2026` and have no dates/region.

| ID | Format | status | current_stage | season_id |
|---:|---|---|---|---|
| 1 | 2v2 | active | NULL | column absent |
| 2 | 3v3 | active | NULL | column absent |

### Team 2 — Frantic

- `id=2`, `name=Frantic`, `format=3v3`, `active=true`
- `display_name=Frantic`, `short_name=Frantic`, `slug=frantic`
- colors `#FF00A6` / `#CAFF00`, `wordmark_style=default`
- linked history: 5 series, 21 games, 5 current player rows, 5 membership
  rows, 1 competition entry, 2 scheduled matches, 0 playoff-side links

### Competition entry 122

- `entry_id=122`, `competition_id=2`, `fr_team_id=2`
- slug `summer-2026-t5-frantic`
- display snapshot `Flop Reset - Frantic`
- tier `5`, registration `registered`, competitive status `active`, row status `active`
- source provider `v24_verified_brief`; no external source ID or source URL

### Active Flop Reset teams

- 1 — Fracture 3v3
- 2 — Frantic 3v3
- 3 — Frameshift 3v3
- 5 — Fracture 2v2

Future 3v3 count is zero. The unique `(name, format)` index required by the
Future upsert exists.

### Table counts

| Table | Count |
|---|---:|
| teams | 4 |
| competitions | 2 |
| competition_entries | 40 |
| series | 15 |
| matches | 53 |
| match_player_stats | 159 |
| league_matches | 402 |
| playoff_brackets | 4 |
| playoff_matches | 49 |
| competition_sources | 0 |
| external_source_snapshots | 0 |
| competition_roster_members | 0 |

All 15 Summer series (IDs 32–46) and all 402 Summer league rows (IDs 767–1168)
still have `competition_phase IS NULL`.

### RPC and permissions

`apply_rivalry_playoff_sync(jsonb)` is absent, so it currently has no grants.
Migration 014 explicitly revokes execution from `public`, `anon`, and
`authenticated`, then grants execution only to `service_role`.

Production has one Auth user and that user has
`app_metadata.site_admin=true`. Legacy authenticated-wide write policies still
exist on several core tables. That is existing RLS drift; the atomic RPC grant
does not remove direct table-write policies.

## Required production sequence

1. Do not rerun migration 012.
2. Resolve the missing Power foundation before Future activation: either apply
   a separately reviewed, explicitly transactional compatibility migration for
   the missing migration-005 objects, or harden the Future script so it does
   not reference an absent table. Do not run migration 005 blindly as written.
3. Apply migration 014 in its transaction and verify the function is
   `SECURITY DEFINER`, owned by the expected role, and executable only by
   `service_role`.
4. Apply migration 015 in its transaction. Expected data effect: create one
   active Summer season and attach competitions 1 and 2 to it. It must not set
   placements, awards, roster snapshots, or historical phases.
5. Validate archive views/RLS and old V2.3.9 rendering.
6. Deploy the already-tested V2.4 artifact and smoke-test production.
7. In a separate guarded lifecycle transaction, mark competitions 1 and 2 and
   the linked Summer season `completed`. This is a lifecycle fact only; do not
   fill unknown history.
8. Only after the V2.4 smoke test and Power/Future precondition are green, run
   `supabase/manual/202609290022_future_current_team.sql`.

## Summer state recommendation

Treat Summer as **completed but not fully reconciled**. The smallest truthful
transition is:

- competitions 1 and 2: `status='completed'`, `current_stage='completed'`
- linked Summer season: `status='completed'`
- leave the 15 series phases, 402 league phases, unresolved identities,
  placements, event rosters, awards, and Final Regular Season Power snapshot
  unchanged until evidence exists

Do not run the strict archive-closeout script yet; its reconciliation, roster,
bracket, and immutable-Power prerequisites are intentionally unmet.

## Recovery

- Before deployment: a failure in migrations 014/015 rolls back their explicit
  transaction.
- After additive schema succeeds but application smoke fails: roll the Vercel
  production alias back to V2.3.9. Leave additive schema in place; do not drop
  archive tables during an incident.
- Summer lifecycle rollback restores competition rows 1/2 to
  `status='active'`, `current_stage=NULL`, and restores the season's prior
  status using the captured before-image.
- Future rollback uses
  `supabase/manual/202609290022_future_current_team_rollback.sql` and is allowed
  only before Future receives any roster, entry, schedule, result, playoff, or
  Power linkage. It deletes only that generated Future row and reactivates
  Frantic.

## Quality gate at audited commit

- lint: passed
- TypeScript: passed
- full test suite: passed
- Next.js 16.2.12 Turbopack production build: passed

## Decision

**NOT SAFE TO MIGRATE as one end-to-end Phase 6 cutover yet.**

Migrations 014 and 015 are catalog-compatible and independently ready for a
controlled production window, but the full requested sequence remains blocked
by the absent `team_rating_snapshots`/migration-005 foundation (which makes the
current Future activation script fail) and by the lack of migration bookkeeping.
Prepare/rehearse the transactional Power compatibility step first, then refresh
this preflight immediately before production execution.
