# V2.3.9 Rivalry Reconciliation — 2026-08-26

Read-only live comparison performed against the two configured public Rivalry competition pages and the current legacy `league_matches` pool. No source snapshot or competition entry was applied to production.

| Format | Rivalry entries | Distinct source names | FR league-result teams | Direct intersection | Rivalry-only | FR-only | Known-alias matches | Unresolved | Stable team IDs on roster cards |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 3v3 | 86 | 86 | 91 | 85 | 1 | 6 | 0 | 1 | 0 |
| 2v2 | 62 | 62 | 66 | 62 | 0 | 4 | 0 | 0 | 0 |

The previously observed 75/66 source counts are stale. V2.3.9 deliberately reads the source declaration at preview time and never hardcodes either set of counts.

The live production `league_matches` table is still legacy/unscoped: it has 231 3v3 rows and 171 2v2 rows but no `competition_id` column. These counts therefore describe the current Summer pool by format, not a fully competition-scoped V2.3.9 directory.

## Identity conclusion

Rivalry’s server-rendered competition roster cards expose tier, display name, roles, and roster members, but no stable team or player IDs. Stable team IDs are available on the separate public team directory. V2.3.9 therefore creates competition-scoped registrations first and leaves canonical identity unresolved until a stable source ID or an Admin decision confirms the mapping. Same-name entries are never auto-merged.

## Sources

- 3v3: https://therivalry.gg/competitions/6a110a8ee2b67775afcb5921
- 2v2: https://therivalry.gg/competitions/6a1e4613e2b67775afcb5922
