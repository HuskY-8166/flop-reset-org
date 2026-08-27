# Ballchasing `players.csv` import contract

Verified against the local August 2026 Ballchasing exports. `players.csv` is a
semicolon-delimited aggregate with one row per player, `games` as the row
weight, and no replay ID or game date. Therefore it is the required primary
advanced-tracking file, but it cannot by itself prove a destination
`match_player_stats` row. A replay-level companion is required for a safe
per-game database write. Aggregate values are never copied into every game.

## Exact header detected

The verified Ohio Midlads export contains these 100 columns, in this observed
order (the parser maps by normalized header name and does not depend on order):

`team name`; `player name`; `games`; `wins`; `win percentage`; `score`;
`score per game`; `goals`; `goals per game`; `assists`; `assists per game`;
`saves`; `saves per game`; `shots`; `shots per game`; `shots conceded`; `shots
conceded per game`; `goals conceded`; `goals conceded per game`; `goals
conceded while last defender`; `goals conceded while last defender per game`;
`shooting percentage`; `bpm per game`; `avg boost amount per game`; `amount
collected`; `amount collected per game`; `amount collected big pads`; `amount
collected big pads per game`; `amount collected small pads`; `amount collected
small pads per game`; `count collected big pads`; `count collected big pads per
game`; `count collected small pads`; `count collected small pads per game`;
`amount stolen`; `amount stolen per game`; `amount stolen big pads`; `amount
stolen big pads per game`; `amount stolen small pads`; `amount stolen small pads
per game`; `count stolen big pads`; `count stolen big pads per game`; `count
stolen small pads`; `count stolen small pads per game`; `0 boost time`; `0 boost
time per game`; `100 boost time`; `100 boost time per game`; `amount used while
supersonic`; `amount used while supersonic per game`; `amount overfill total`;
`amount overfill total per game`; `amount overfill stolen`; `amount overfill
stolen per game`; `avg speed per game`; `total distance`; `total distance per
game`; `time slow speed`; `time slow speed per game`; `time boost speed`; `time
boost speed per game`; `time supersonic speed`; `time supersonic speed per game`;
`time on ground`; `time on ground per game`; `time low in air`; `time low in air
per game`; `time high in air`; `time high in air per game`; `time powerslide`;
`time powerslide per game`; `avg powerslide time per game`; `count powerslide`;
`count powerslide per game`; `time most back`; `time most back per game`; `time
most forward`; `time most forward per game`; `time in front of ball`; `time in
front of ball per game`; `time behind ball`; `time behind ball per game`; `time
defensive half`; `time defensive half per game`; `time offensive half`; `time
offensive half per game`; `time defensive third`; `time defensive third per
game`; `time neutral third`; `time neutral third per game`; `time offensive
third`; `time offensive third per game`; `avg distance to ball per game`; `avg
distance to ball has possession per game`; `avg distance to ball no possession
per game`; `avg distance to team mates per game`; `demos inflicted`; `demos
inflicted per game`; `demos taken`; `demos taken per game`.

## File detection

- `players.csv`: `team name`, `player name`, and `games`; no `replay id`.
- `players-games.csv`: `replay id` and `player name`. If uploaded as the primary
  file it is identified and blocked with an instruction to upload `players.csv`.
- Unknown: neither signature. Missing basic headers are reported.

## Supported mapping

| `players.csv` source | Flop Reset field | Rule |
|---|---|---|
| `goals`, `assists`, `saves`, `shots`, `score` | same box-score fields | Aggregate validation totals only |
| `bpm per game` | `bpm` | Direct numeric value |
| `avg speed per game` | `avg_speed` | Direct numeric value |
| `amount collected per game` | `boost_collected` | Aggregate preview/validation only |
| `amount stolen per game` | `boost_stolen` | Aggregate preview/validation only; Boost Steal Rate formula unchanged |
| `demos inflicted per game`, `demos taken per game` | `demos_inflicted`, `demos_taken` | Aggregate preview/validation only |
| `time supersonic speed per game` | `percentage_supersonic_speed` | Divide by slow + boost + supersonic time; multiply by 100 |
| `time on ground per game` | `percentage_on_ground` | Divide by ground + low-air + high-air time; multiply by 100 |
| `time low in air per game` | `percentage_low_air` | Same movement-time denominator |
| `time high in air per game` | `percentage_high_air` | Same movement-time denominator |
| `time most back per game`, `time most forward per game` | `percentage_most_back`, `percentage_most_forward` | Divide by tracked movement time; multiply by 100 |
| `time behind ball per game`, `time in front of ball per game` | `percentage_behind_ball`, `percentage_in_front_of_ball` | Divide by the behind + in-front family total |
| `time defensive half per game`, `time offensive half per game` | `percentage_defensive_half`, `percentage_offensive_half` | Divide by the half family total |
| `time defensive third per game`, `time neutral third per game`, `time offensive third per game` | matching third percentages | Divide by the third family total |
| `avg distance to ball per game` | `avg_distance_to_ball` | Direct numeric value |
| `avg distance to ball has possession per game` | `avg_distance_to_ball_has_possession` | Direct numeric value |
| `avg distance to ball no possession per game` | `avg_distance_to_ball_no_possession` | Direct numeric value |
| `avg distance to team mates per game` | `avg_distance_to_teammates` | Direct numeric value |
| `0 boost time per game` | `zero_boost_pct` | Divide by tracked movement time; multiply by 100 |

The replay-level companion maps its explicit `percentage ...` headers directly
without scaling, and maps exact per-game totals (`bpm`, `avg speed`, `amount
collected`, `amount stolen`, demos, and box score) to the matching database row.

## NULL and conflict rules

- Missing/blank/non-numeric source values map to `NULL`, never zero.
- A measured `0` remains zero.
- Backfill updates omit every incoming `NULL`, preserving stored values.
- Goals, assists, saves, shots, and score are compared before any write. Any
  mismatch blocks that row/import; basic stats are never silently replaced.
- Replay IDs, explicit two-side grouping, format-sized FR resolution, and one
  unique destination series are required before a write.

## Unsupported from `players.csv` alone

Replay identity, game date, game order, per-game scores, MVPs, and exact
per-game advanced values. These cannot be reconstructed from aggregate rows.
