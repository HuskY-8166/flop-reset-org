# V2.3.9 League Directory Runbook

## Source architecture

`RivalrySourceAdapter` is implemented as a versioned, fail-closed parser:

1. Admin selects an FR competition and public Rivalry URL.
2. A server route validates the hostname/path, rate-limits the user, applies a timeout, and fetches anonymous public HTML with an identifying user agent.
3. `RIVALRY_SOURCE_V1` parses the server-rendered Event Rosters section.
4. Declared and parsed roster counts must match exactly.
5. A normalized snapshot and SHA-256 content hash are stored.
6. Admin reviews directory, roster, identity, lock, and reconciliation differences.
7. Apply is explicit, idempotent by source registration key, and soft-archives removals.
8. Public pages read only the FR database and last-good snapshot state.

No page load fetches Rivalry. No private endpoint, authentication bypass, or team-directory crawl is used.

## Manual migration order

Do not run the competitive reset as part of V2.3.9 setup.

1. Review and apply `supabase/migrations/202608260009_series_result_domain_compatibility.sql` if still pending from V2.3.8.
2. Review and apply `supabase/migrations/202608260011_league_directory_foundation.sql`.
3. Confirm the Admin JWT has `app_metadata.site_admin = true`.
4. Review and manually apply `supabase/manual/202608260012_harden_admin_rls.sql` after inspecting its pre-change policy report.
5. Reload Admin → League Directory and confirm Data Health loads without a schema warning.
6. Configure the matching 3v3 and 2v2 competition source URLs.
7. Preview each source independently.
8. Review new, changed, removed, duplicate, locked, alias, FR-only, Rivalry-only, and Power-only counts.
9. Apply only the reviewed snapshot.
10. Reconcile unresolved team identities and stable Rivalry team IDs manually.
11. Mark active/tiered/Power-tracked states only from verified league evidence.

## Admin authorization

Public pages read narrow projection views that omit notes, manual/source values, lock state, reconciliation evidence, and Admin identifiers. The structural base tables are Admin-only. Every new-table mutation policy requires the existing `app_metadata.site_admin` JWT claim, and the Admin client gate and login page enforce the same claim. Future authenticated fan/community accounts do not inherit Admin reads or writes.

## Reset compatibility

The guarded competitive reset still deletes only player-game stats, matches, series, derived rating snapshots, and league results in explicit child-to-parent order. V2.3.9 structural tables do not point into that reset scope. The reset now captures and verifies row counts for:

- competition sources
- external team source mappings
- competition entries
- league players
- competition roster membership
- source snapshots
- reconciliation queue
- Admin audit history
- controlled page content

The reset remains compatible both before and after the V2.3.9 migration is applied.
