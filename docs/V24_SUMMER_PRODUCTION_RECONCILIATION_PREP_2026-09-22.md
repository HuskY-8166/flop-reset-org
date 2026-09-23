# V2.4 Summer 2026 Production Reconciliation Preparation

Prepared: 2026-09-22
Branch: `v2.4-fall-foundation`
Mode: read-only production audit plus unexecuted, reversible SQL preparation

## Production audit findings

- The authenticated League Directory reports 40 competition entries, 3 canonical FR mappings, 37 unresolved entries, 0 duplicate source IDs, and roster coverage of 0/40.
- All 40 entries have `source_external_id = NULL` and no source URL. The only mapped entries are the three FR identities: 121 Fracture, 122 Frantic, and 123 Frameshift.
- The authenticated Sources screen has no configured source row for either Summer competition: the source URL is blank and no source metadata card is rendered.
- `identity_reconciliation_queue` is empty; Admin reports “No identity issues are queued.”
- Admin exposes no `external_source_snapshots` listing. There is no usable validated/applied snapshot referenced by a Summer source, and no V2.3.9 source-apply audit event. The exact raw snapshot-table count still requires a direct authenticated SQL/REST read; it cannot be proven from the current Admin UI.
- Canonical opponents contain only two recorded aliases: opponent 7 has `SBC Angels`; opponent 9 has `MIDLADS`.
- Production still has series 32-46 with NULL phase and NULL opponent identity, plus league-match IDs 767-1168 (402 contiguous rows) with NULL phase. The league split is 171 rows in competition 1 and 231 rows in competition 2.
- `team_rating_snapshots` is not present in the live PostgREST schema cache.

## Identity comparison

These are candidate crosswalks only. They are **not authenticated source-ID confirmations** because every involved competition entry lacks a Rivalry stable team ID and the database has no usable Summer source snapshot.

| Series | Historical display | Candidate canonical ID | Canonical name | Existing alias | Current decision |
|---:|---|---:|---|---|---|
| 32 | SBC Blue Angels | 7 | SBC Blue Angels | SBC Angels | blocked pending source ID |
| 33 | NBDA SOLAR | 2 | NBDA SOLAR | — | blocked pending source ID |
| 34 | GATOR SPORTS | 1 | Gator Sports | — | blocked pending source ID |
| 35 | DIVINE ZERO | 15 | DIVINE ZERO | — | blocked pending source ID |
| 36 | THE BURTON BATTLERS | 10 | The Burton Battlers | — | blocked pending source ID |
| 37 | SIMPLIFY BROWN | 6 | SIMPLIFY BROWN | — | blocked pending source ID |
| 38 | STORMCORE VORTEX | 12 | STORMCORE VORTEX | — | blocked pending source ID |
| 39 | SIMPLIFY GREEN | 5 | SIMPLIFY GREEN | — | blocked pending source ID |
| 40 | PHANTOM PRESSURE | 4 | PHANTOM PRESSURE | — | blocked pending source ID |
| 41 | KUNGFU TREACHERY | 3 | KUNGFU TREACHERY | — | blocked pending source ID |
| 42 | THE BOZO COLLECTIVE | — | BOZO exists as ID 8, but unverified | — | remain NULL |
| 43 | FAKE SQUAD | 11 | FAKE SQUAD | — | blocked pending source ID |
| 44 | PHANTISMS | 13 | PHANTISMS | — | blocked pending source ID |
| 45 | OHIO MIDLADS | 9 | Ohio Midlads | MIDLADS | blocked pending source ID |
| 46 | SPARTAN ARES | 14 | SPARTAN ARES | — | blocked pending source ID |

The 11 requested competition-entry candidates are:

| Entry | Historical display | Candidate opponent |
|---:|---|---:|
| 156 | StormCore Vortex | 12 |
| 157 | Phantisms | 13 |
| 135 | Gator Sports | 1 |
| 137 | Simplify Green | 5 |
| 143 | Simplify Brown | 6 |
| 149 | Spartan Ares | 14 |
| 124 | Ohio Midlads | 9 |
| 127 | Phantom Pressure | 4 |
| 130 | The Burton Battlers | 10 |
| 132 | SBC Blue Angels | 7 |
| 150 | Fake Squad | 11 |

The remaining 26 unresolved entries must not create new canonical opponents until their stable source identities are verified:

- Tier 4: 125 NBDA Neon; 128 Silver Singles; 133 Phantom Whiffskateers; 139 Spartan Trionda; 140 Ronin; 142 Instinct; 145 Cosmic Esports; 147 Phantom; 151 Phantom mobs; 153 Kung-Fu Treachery; 154 Eternal Ronin OG; 155 SWORDFISH MEN; 160 Happy Little Plats.
- Tier 5: 129 Event Horizon NES; 131 Chanclas Agresivas; 136 New Age Phantoms; 138 The Bozo Collective; 144 Spartan Guardians; 146 No Boost Specials; 148 The Whiffing Wontons; 158 Four Mattsketeers.
- Tier 6: 126 SuperSonic DADS; 134 EC United; 141 MwM | Golden Clouds; 152 Pigeon Boys; 159 Hypertension Gaming.

## Bracket evidence and prepared changes

Read-only source: `https://therivalry.gg/competitions/6a110a8ee2b67775afcb5921/tab/bracket`.

- Match 73: Frameshift 3-4 Fake Squad, final.
- Match 66: Frantic 4-2 Gator Sports, final.
- Match 68: Four Mattsketeers 4-1 Frantic, final.
- Match 70: New Age Phantoms vs Frantic participants only; result remains TBD.
- Match 46 (Fracture 4-0 NBDA Neon) and match 50 (SWORDFISH MEN 4-2 Fracture) are exact-guarded and never updated.
- No statistical series, games, player stats, BYE, or forfeit row is created by the bracket reconciliation.

## Blank Tier 4 bracket

Bracket 2 belongs to competition 1 (2v2), while bracket 9 belongs to competition 2 (3v3). They are therefore not proven duplicates. Bracket 2 contains only blank match 22 and has no routing, participant, score, result, series, schedule, BYE, forfeit, or notes.

Recommendation: use Option A and retain bracket 2 with `status='hidden'`. Public and archive queries in this branch exclude hidden brackets, while Admin retains the provenance. Deletion is reversible but is less safe until the intended 2v2 structure is verified.

## Power freeze requirements

The current production schema cannot yet produce a defensible immutable Final Regular Season Power snapshot:

1. `team_rating_snapshots` is not available in the live schema cache. Migration `202608240005_power_engine_foundation.sql` and its prerequisite `202608240003` must be validated/applied in staging before any freeze.
2. No application/Admin path writes a final snapshot.
3. `model_version` has no approved value for the Summer freeze.
4. The schema has no freeze/batch record, approval timestamp, content hash, or database rule preventing update/delete; “immutable” is currently only a table comment.
5. Snapshot identity is name-based and does not store a competition entry/team identity.
6. The snapshot row has no phase column. Every Round 5 row must therefore be proven through its linked `league_matches.id` to use `competition_phase='regular_season'`.
7. A complete Round 5 team set must be reconciled against distinct completed league teams for competitions 1/2, with forfeits producing zero rating movement and BYEs producing no row.

Do not freeze Power until those seven points have an approved implementation and a staging rehearsal.

## Prepared SQL and rollback files

- `supabase/manual/202609220016_summer_phase_backfill.sql`
- `supabase/manual/202609220016_summer_phase_backfill_rollback.sql`
- `supabase/manual/202609220017_summer_competition_entry_reconciliation.sql`
- `supabase/manual/202609220017_summer_competition_entry_reconciliation_rollback.sql`
- `supabase/manual/202609220018_summer_series_identity_reconciliation.sql`
- `supabase/manual/202609220018_summer_series_identity_reconciliation_rollback.sql`
- `supabase/manual/202609220019_summer_playoff_reconciliation.sql`
- `supabase/manual/202609220019_summer_playoff_reconciliation_rollback.sql`
- `supabase/manual/202609220020a_blank_t4_retain_hidden.sql`
- `supabase/manual/202609220020a_blank_t4_retain_hidden_rollback.sql`
- `supabase/manual/202609220020b_blank_t4_delete.sql`
- `supabase/manual/202609220020b_blank_t4_delete_rollback.sql`
- `supabase/manual/202609220021_summer_archive_closeout.sql`
- `supabase/manual/202609220021_summer_archive_closeout_rollback.sql`

Each write script uses an explicit transaction, exact row guards, durable before-images under `fr_release_backup`, post-write assertions, and an exact-ID rollback companion.

All listed migrations, every forward script, the guarded closeout, every rollback companion, and both blank-bracket options passed an isolated PGlite rehearsal on 2026-09-22. Application lint, TypeScript, all 15 tests, and the production build also passed. A real Supabase staging rehearsal is still required before the first production write because PGlite cannot reproduce PostgREST schema-cache behavior, production roles, or the exact live extensions and policies.

## Proposed production order

1. Revalidate the updated migration 015 in the non-production database. It now creates Summer as active and no longer marks it completed by name.
2. Apply migrations 012, 014, and 015 in that order.
3. Run the phase backfill for series 32-46 and league rows 767-1168.
4. Configure competition 2's Rivalry source, create a reviewed preview snapshot, and inspect stable IDs. Do not apply identity changes by name.
5. Apply the reviewed directory snapshot so external team rows and reconciliation queue entries exist.
6. Resolve all 37 competition entries with authenticated source evidence; run the 11-row entry script only after its source-ID guards pass. Do not create the other 26 opponents without verified identities.
7. Run the 14-row series identity script after its source-ID guards pass; keep series 42 NULL until The Bozo Collective is verified.
8. Capture verified roster snapshots.
9. Run the atomic playoff reconciliation and then the normal atomic Rivalry playoff sync; inspect its full diff before applying.
10. Use blank-bracket Option A after the public hidden-bracket filters are deployed. Do not run Option B unless the owner explicitly chooses deletion.
11. Install/validate the missing Power snapshot schema, implement a real immutable freeze, and capture the approved Round 5 snapshot using regular-season evidence only.
12. Run the final archive closeout transaction. It is the only prepared script that marks competitions 1/2 and the Summer season completed, and it fails closed until all dependencies pass.

## Rollback order

If the final closeout has run, reverse in this order:

1. `202609220021_summer_archive_closeout_rollback.sql`
2. the selected `202609220020a` or `202609220020b` rollback
3. `202609220019_summer_playoff_reconciliation_rollback.sql`
4. `202609220018_summer_series_identity_reconciliation_rollback.sql`
5. `202609220017_summer_competition_entry_reconciliation_rollback.sql`
6. `202609220016_summer_phase_backfill_rollback.sql`

Migration rollback must use a separately reviewed recovery migration; do not manually drop archive tables or the atomic RPC in production.

## Blockers before the first production write

- Updated migration 015 passed the isolated rehearsal after automatic Summer completion was removed, but still requires the planned real Supabase staging rehearsal.
- The exact raw `external_source_snapshots` table count still needs a direct authenticated SQL/REST read; current Admin does not expose it.
- No Summer competition source or stable team identity exists in production.
- The 11 name matches and 14 series candidates are not source-ID authorized.
- Series 42/The Bozo Collective is unresolved.
- All 37 non-FR competition entries are unresolved; all 40 entries lack source IDs and roster coverage is 0/40.
- The immutable Power freeze does not yet exist.
- No prepared SQL in this package has been executed.
