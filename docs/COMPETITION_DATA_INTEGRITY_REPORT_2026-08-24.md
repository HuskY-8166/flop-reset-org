# Competition Data Integrity Report — 2026-08-24

This report was produced from read-only Supabase queries. No production row was changed.

## Competition diagnosis

- Competition 1: The Rivalry / Summer Circuit / 2026 / 2v2.
- Competition 2: The Rivalry / Summer Circuit / 2026 / 3v3.
- Series 12 is correctly attached to Competition 2. It is Frameshift vs SBC Angels on 2026-07-20: one forfeit game, `0-0`, `result_override='win'`, and zero player-stat rows.
- The other 14 series are attached to Competition 1 but every attached Flop Reset squad is a 3v3 team. Their match-level `competition_id` and `flop_reset_team_id` agree with their parent series, so the bad assignment is internally consistent but format-invalid.

## Series audit

| Series | Date | Competition | Competition format | Team | Team format | Opponent | Games | Stat rows | Forfeit | Integrity |
|---:|---|---:|---|---|---|---|---:|---:|---|---|
| 12 | 2026-07-20 | 2 | 3v3 | Frameshift | 3v3 | SBC Angels | 1 | 0 | Win, 0-0 | Valid |
| 16 | 2026-07-23 | 1 | 2v2 | Fracture | 3v3 | NBDA SOLAR | 3 | 9 | No | Mismatch |
| 17 | 2026-07-23 | 1 | 2v2 | Frantic | 3v3 | Gator Sports | 5 | 15 | No | Mismatch |
| 18 | 2026-07-28 | 1 | 2v2 | Fracture | 3v3 | DIVINE ZERO | 4 | 12 | No | Mismatch |
| 25 | 2026-07-30 | 1 | 2v2 | Frameshift | 3v3 | The Burton Battlers | 3 | 9 | No | Mismatch |
| 20 | 2026-08-02 | 1 | 2v2 | Frantic | 3v3 | SIMPLIFY BROWN | 4 | 12 | No | Mismatch |
| 21 | 2026-08-07 | 1 | 2v2 | Fracture | 3v3 | STORMCORE VORTEX | 3 | 9 | No | Mismatch |
| 22 | 2026-08-07 | 1 | 2v2 | Frantic | 3v3 | SIMPLIFY GREEN | 4 | 12 | No | Mismatch |
| 23 | 2026-08-08 | 1 | 2v2 | Frameshift | 3v3 | PHANTOM PRESSURE | 3 | 9 | No | Mismatch |
| 26 | 2026-08-13 | 1 | 2v2 | Fracture | 3v3 | KUNGFU TREACHERY | 4 | 12 | No | Mismatch |
| 27 | 2026-08-14 | 1 | 2v2 | Frantic | 3v3 | BOZO | 3 | 9 | No | Mismatch |
| 28 | 2026-08-14 | 1 | 2v2 | Frameshift | 3v3 | FAKE SQUAD | 3 | 9 | No | Mismatch |
| 29 | 2026-08-18 | 1 | 2v2 | Fracture | 3v3 | PHANTISMS | 4 | 12 | No | Mismatch |
| 31 | 2026-08-21 | 1 | 2v2 | Frantic | 3v3 | SPARTAN ARES | 5 | 15 | No | Mismatch |
| 30 | 2026-08-23 | 1 | 2v2 | Frameshift | 3v3 | MIDLADS | 5 | 15 | No | Mismatch |

## Recommended correction

After taking a database backup and reviewing the prepared transaction, move series 16, 17, 18, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30, and 31—and their attached match rows—from Competition 1 to Competition 2.

This recommendation is based on all three independent signals agreeing:

1. Competition 2 is the Summer Circuit 2026 3v3 entity.
2. Every affected team registration is 3v3.
3. Every affected series contains normal three-player-per-game stat coverage.

Do not delete Competition 1. It remains the separate Summer Circuit 2026 2v2 history and should stay empty until verified 2v2 results are imported.

## Other findings

- Series 18, 20, 22, 26, and 29 store `best_of=4`. They contain four played games, but the intended scheduled series length cannot be proven from this database alone. Do not automatically rewrite them to Bo5 without source confirmation.
- Competitive history begins on 2026-07-20 with the official forfeit series. Player performance tracking begins on 2026-07-23 because the forfeit correctly has no player statistics.
- The public application withholds mismatched series from competition-scoped standings, results, and leaders until the repair is approved.

