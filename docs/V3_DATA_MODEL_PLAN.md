# Flop Reset V3 data model plan

This is a review document, not an applied migration. Apply changes first in a disposable Supabase branch and validate every public page and admin flow before production.

## Canonical outcomes

`matches.forfeit_result` is the Flop Reset-perspective result (`win` or `loss`). `is_forfeit` identifies the event, and displayed forfeit scores remain `0–0`. Score columns are performance goals only for non-forfeit games. The web app uses `lib/results.ts` as the compatibility boundary: explicit results win; legacy 1–0 / 0–1 encoding remains a temporary fallback.

Series outcomes are derived from canonical game outcomes. Player box scores, Process metrics, career highs, goal differential, and record-book scoring exclude forfeits. Team game/series records may include forfeits.

## Historical identity

The historical squad belongs to `matches.flop_reset_team_id`. Player rows describe roster registration and aliases, not immutable match history. All career grouping should use `match_player_stats -> matches -> teams`; profile headers may separately show current/registered rosters.

Longer term, add `series_roster_members(series_id, player_id, team_id, role)` so legitimate player participation in a forfeit can be recorded without creating fake box-score rows.

## Competition and schedule semantics

- `series.best_of` is the intended scheduled length, always a positive odd number.
- Games played is derived from child matches and must not overwrite `best_of`.
- Add a normalized opponent entity and alias table before merging opponent histories. Current normalization only removes punctuation/case/spacing and does not invent fuzzy aliases.
- Store a competition stage and authoritative ordering key before claiming streaks across same-day games where order is unknown.

## Import transaction

Move new-series creation, matches, and player-stat inserts into one Postgres function receiving validated JSON. The function must run in a single transaction, reject duplicate replay IDs, verify every player belongs to the selected roster or an explicit series roster, and return created IDs. Until that RPC ships, the client importer performs compensating cleanup and must report cleanup failures rather than claiming a clean rollback.

Optional Ballchasing Process fields must remain `NULL` when absent. Real zeroes remain zero. Canonical names and aliases match exactly after trim/case normalization; substring matching is prohibited.

## Security rollout

The prepared RLS migration makes public data anonymously readable and gates writes on `app_metadata.site_admin`. Before applying it:

1. verify the production admin account receives that JWT claim;
2. test every admin insert/update/delete in a branch;
3. verify service-role jobs bypass policies only where intended;
4. add policy regression tests;
5. rotate any browser-exposed privileged key immediately if one has ever existed.

## Process Skills open questions

The current Boost Steal Rate definition in `lib/processSkills.ts` must be verified against the Ballchasing field semantics before changing its formula or historical rankings. Preserve missingness and sample coverage during that review. Rankings and medals remain format-specific.

