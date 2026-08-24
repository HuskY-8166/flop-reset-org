# Competition data audit — 2026-08-24

Read-only audit of `competitions`, `teams`, `series`, `matches`, `match_player_stats`, and the related `scheduled_matches` table. No production data was changed.

## Executive finding

Competition ID 1 is labeled and formatted as 2v2, but all 14 attached series, all 53 games, all 159 player-stat rows, and all three participating squads are 3v3. Every result attached to ID 1 is therefore invalid in its current competition context.

Competition ID 2 is a valid 3v3 shell. It contains the July 20 Frameshift–SBC Angels forfeit and owns five completed 3v3 schedule rows that correspond closely to later result series currently misattached to ID 1. This is strong evidence that the 14 series belong to the ID 2 Summer Circuit 3v3 context, while ID 1 was intended to remain the 2v2 context. It is not evidence for swapping the two labels.

## Competition data audit

| ID | Stored name | Intended display | Format | Series | Games | Player stat rows | Teams | Earliest | Latest | Invalid series |
|---:|---|---|---|---:|---:|---:|---|---|---|---:|
| 1 | The Rivalry — 2v2 | The Rivalry — Summer Circuit 2026 | 2v2 | 14 attached / 0 valid | 53 attached / 0 valid | 159 attached / 0 valid | Fracture 3v3, Frantic 3v3, Frameshift 3v3 | Jul 23, 2026 | Aug 23, 2026 | 14 |
| 2 | The Rivalry — 3v3 | The Rivalry — Summer Circuit 2026 | 3v3 | 1 valid | 1 valid | 0 | Frameshift 3v3 | Jul 20, 2026 | Jul 20, 2026 | 0 |

Database totals: 2 competitions, 4 teams, 15 series, 58 matches, 159 player-stat rows, and 5 completed schedule rows.

## Every series

| Series | Date | Competition | Competition format | Team ID | Team | Team format | Opponent | Games | Forfeit | Player stats | Status |
|---:|---|---:|---|---:|---|---|---|---:|---|---:|---|
| 12 | Jul 20, 2026 | 2 | 3v3 | 3 | Frameshift | 3v3 | SBC Angels | 1 | All games | 0 | VALID |
| 16 | Jul 23, 2026 | 1 | 2v2 | 1 | Fracture | 3v3 | NBDA SOLAR | 3 | No | 9 | INVALID |
| 17 | Jul 23, 2026 | 1 | 2v2 | 2 | Frantic | 3v3 | Gator Sports | 5 | No | 15 | INVALID |
| 18 | Jul 28, 2026 | 1 | 2v2 | 1 | Fracture | 3v3 | DIVINE ZERO | 4 | No | 12 | INVALID |
| 20 | Aug 2, 2026 | 1 | 2v2 | 2 | Frantic | 3v3 | SIMPLIFY BROWN | 4 | No | 12 | INVALID |
| 21 | Aug 7, 2026 | 1 | 2v2 | 1 | Fracture | 3v3 | STORMCORE VORTEX | 3 | No | 9 | INVALID |
| 22 | Aug 7, 2026 | 1 | 2v2 | 2 | Frantic | 3v3 | SIMPLIFY GREEN | 4 | No | 12 | INVALID |
| 23 | Aug 8, 2026 | 1 | 2v2 | 3 | Frameshift | 3v3 | PHANTOM PRESSURE | 3 | No | 9 | INVALID |
| 25 | Jul 30, 2026 | 1 | 2v2 | 3 | Frameshift | 3v3 | The Burton Battlers | 3 | No | 9 | INVALID |
| 26 | Aug 13, 2026 | 1 | 2v2 | 1 | Fracture | 3v3 | KUNGFU TREACHERY | 4 | No | 12 | INVALID |
| 27 | Aug 14, 2026 | 1 | 2v2 | 2 | Frantic | 3v3 | BOZO | 3 | No | 9 | INVALID |
| 28 | Aug 14, 2026 | 1 | 2v2 | 3 | Frameshift | 3v3 | FAKE SQUAD | 3 | No | 9 | INVALID |
| 29 | Aug 18, 2026 | 1 | 2v2 | 1 | Fracture | 3v3 | PHANTISMS | 4 | No | 12 | INVALID |
| 30 | Aug 23, 2026 | 1 | 2v2 | 3 | Frameshift | 3v3 | MIDLADS | 5 | No | 15 | INVALID |
| 31 | Aug 21, 2026 | 1 | 2v2 | 2 | Frantic | 3v3 | SPARTAN ARES | 5 | No | 15 | INVALID |

All 53 matches belonging to series 16–31 also repeat the same 2v2-competition / 3v3-team mismatch. No scheduled match has a format mismatch.

## Evidence about IDs 1 and 2

- ID 1 metadata says 2v2 in both its name and `format`. It has no schedule rows.
- ID 2 metadata says 3v3 in both its name and `format`.
- Five completed ID 2 schedule rows are for Fracture, Frantic, and Frameshift 3v3 against StormCore Vortex, Simplify Green, Phantom Pressure, Spartan Ares, and Ohio Midlads.
- Corresponding completed result series against those opponents are attached to ID 1. Naming varies slightly for Ohio Midlads/MIDLADS, so opponent identity should be reviewed during migration rather than fuzzy-merged automatically.
- Each normal ID 1 game has exactly three player-stat rows, corroborating 3v3 participation.
- ID 2’s SBC Angels row is explicitly `is_forfeit = true`, has notes `Forfeit —`, no replay ID, and zero player-stat rows.

## SBC Angels and archive dates

Series 12, match 33 is definitively a forfeit win under the available data. Its stored 1–0 is the legacy result encoding, not a performance goal. Public presentation must be `W · FORFEIT · 0–0`; it must not contribute to goals-for or player statistics.

- Competitive history begins: **Jul 20, 2026**.
- Player-stat tracking begins: **Jul 23, 2026**.

## Recommended correction — requires explicit approval

The evidence supports moving series 16, 17, 18, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30, and 31—and their 53 matches—from competition ID 1 to competition ID 2. `match_player_stats` rows follow matches and should not be rewritten. After the move:

- ID 1 remains the Summer Circuit 2v2 context with zero results.
- ID 2 becomes the Summer Circuit 3v3 context with 15 series and 54 games, including the SBC Angels forfeit.
- Expected ID 2 aggregate becomes 10–5 by series and 33–21 by games when the forfeit counts as a win but not as a scored goal.

Before applying, review the schedule/result opponent-name pairs and confirm that every listed series belongs to The Rivalry Summer Circuit 2026. No correction SQL was executed in this pass.

## Additional integrity issue

Several existing series store even `best_of` values of 4, indicating the field was historically populated with games played rather than intended scheduled length. Do not validate the prepared odd-best-of constraint until those rows are reviewed and corrected.

## Circuit-safe future structure

- Standings now select one competition ID and exclude any result whose squad format does not match that competition. A new Fall competition therefore starts at 0–0 without changing Summer history.
- Rivalry pages remain intentionally cross-circuit and label each competition breakdown by league, circuit, year, and format.
- Player career totals remain cross-competition. A circuit selector is the next profile-layer addition once the corrected series ownership is approved; the stored history is not discarded.
- `league_matches` currently has format but no competition ownership. The prepared migration adds nullable `competition_id`, an index, and a format guard function. Existing ranking rows must be confirmed and backfilled to Summer before the guard and the future Admin circuit selector are enabled. Until then the power-ranking page labels its data as a legacy Summer-only archive and must not receive Fall imports.
