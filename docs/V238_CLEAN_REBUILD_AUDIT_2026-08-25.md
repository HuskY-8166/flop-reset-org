# Flop Reset V2.3.8 clean rebuild audit

Captured from the live Supabase project on August 25, 2026. This report is
read-only evidence. No competitive rows were deleted.

## Readiness result

- Competition/team format mismatches: **0**
- Player aliases: **ready** (`AkTION`, `Drollotov`, `HuskY.G2`)
- Canonical opponents: **ready** (`Ohio Midlads`, `SBC Blue Angels`)
- Canonical opponent aliases: **ready** (`MIDLADS`, `SBC Angels`)
- Canonical clean-import source in the working tree: **required `players-games.csv`**
- Optional aggregate validator: **`players.csv`**
- Production reset executed: **no**

## Pre-reset counts

| Dataset | Live rows |
| --- | ---: |
| Competitions | 2 |
| Teams | 4 |
| Players | 18 |
| Opponents | 15 |
| Series | 15 |
| Match rows | 58 |
| Official played games linked to Summer series | 53 |
| Non-forfeit match rows, including one unlinked legacy row | 54 |
| Legacy forfeit match rows | 4 |
| Player-game rows | 159 |
| Replay IDs | 0 |
| League result rows | 402 |
| Scheduled fixtures | 5 |
| Playoff brackets / matches | 0 / 0 |
| Advanced-tracking player rows | 0 / 159 |

The 58 legacy match rows include four forfeit rows and one additional unlinked
non-forfeit row. The canonical competition summary correctly reports 53 played
games; all 58 legacy rows are inside the reset scope.

## Summer baseline to retain for comparison

| Scope | Series | Series W-L | Games | Game W-L |
| --- | ---: | ---: | ---: | ---: |
| Summer 3v3 / Competition 2 | 15 | 10-5 | 53 | 32-21 |
| Frameshift | 5 | 4-1 | 14 | 9-5 |
| Fracture | 5 | 3-2 | 18 | 11-7 |
| Frantic | 5 | 3-2 | 21 | 12-9 |

- Official forfeit series: **1**
- Earliest played date: **2026-07-23**
- Latest played date: **2026-08-23**

These are comparison targets, not a forced final total. Partial rebuild pages
must report only the verified series imported so far.

## Reset scope

Reset:

- `public.match_player_stats`
- `public.matches`
- `public.series`
- `public.league_matches`
- `public.team_rating_snapshots` when present

Preserve:

- competitions, seasons, teams, players, aliases, memberships
- opponents and opponent aliases
- schedules and future fixtures
- playoff brackets, participants, topology, BYEs, and external results
- logos, authentication, RLS, and admin access

## Foreign-key handling

The reviewed graph expects these inbound edges into reset targets:

| Source | Target | Handling |
| --- | --- | --- |
| `matches.series_id` | `series.series_id` | delete player rows, then matches, then series |
| `playoff_matches.series_id` | `series.series_id` | detach; clear only cached FR result fields |
| `match_player_stats.match_id` | `matches.match_id` | delete player rows first |
| `team_rating_snapshots.match_id` | `league_matches.id` | delete derived snapshots first |

The manual reset script captures the actual live `pg_constraint` graph,
including `ON DELETE` behavior, into the backup schema and aborts if any other
source points into the reset scope. This makes an unknown cascade or hidden
dependent table a transaction blocker.

## Schedule and playoff handling

All five live scheduled fixtures are completed historical schedule rows. They
are preserved as structure/history; the reset does not delete or silently
rewrite them. There are currently no live playoff brackets or playoff matches.
The reset still includes guarded playoff-link handling for future data: an FR
source-series link is detached, cached score/winner fields are cleared when
those columns exist, and completed cached status returns to pending. Unlinked
external-vs-external results remain untouched.

## Playoff Admin

- First-class Admin tab: **yes**
- Supported competitions: every live competition row; currently Summer 3v3 and Summer 2v2
- Existing live brackets discovered: **1** (Summer 3v3 bracket ID 1)
- Existing live tiers discovered: **Tier 6**
- Existing live playoff matches: **3** empty/TBD structure rows created by the P0 Admin verification (Quarterfinal 1-2, Semifinal 1)
- Existing FR paths discovered: **none** (the conceptual Tier 4/5/6 paths were not seeded)
- Bracket and match creation: **available from Admin**
- Participant editing: FR team, canonical opponent, or TBD with independent display snapshot
- BYE behavior: one participant advances; no series, game, W/L, stats, or Power evidence
- Forfeit behavior: explicit bracket advancement; FR statistical result comes from a linked zero-game series
- Series linking: canonical FR series overrides bracket-local score/winner fields
- Winner advancement: explicit confirmation into the configured match/slot; occupied destinations and duplicates are blocked
- Loser advancement: explicit 3rd-place action when loser routing exists
- Routing: visible in normal editing; mutations require Advanced Bracket Structure plus confirmation
- Mobile: authenticated browser verification passed at 390px with no horizontal overflow or console errors

The live schema now contains the participant, score, best-of, forfeit, and
required ordering columns. The P0 hotfix corrected the existing bracket tier
from a legacy name-shaped value to canonical tier `6`, added strict round-order
mapping, and verified deterministic per-round match numbering through Admin.
No participants, routes, results, series links, games, or stats were invented.

## Backup and execution

Before execution, export every table listed in the SQL header. The reset also
creates `fr_rebuild_backup_20260825` inside the same transaction with copies of
all reset datasets, schedules, playoff tables, the live FK graph, and a count
manifest. If a guard or verification fails, PostgreSQL rolls back the entire
transaction.

Manual files:

- `supabase/manual/202608250009_pre_reset_diagnostics.sql` (read only)
- `supabase/manual/202608250009_clean_competitive_rebuild.sql` (manual reset)

The reset uses explicit child-to-parent `DELETE` statements. It does not use
`TRUNCATE`, a cascade command, or structural-table deletion.
