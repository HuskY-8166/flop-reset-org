# Fall 2026 Power initialization plan

Status: prepared for owner approval; no snapshots or ratings have been written.

## Recommended policy

- Competition 3 (2v2) and competition 4 (3v3) are separate rating pools.
- Every registered team enters its pool at 1500 Elo.
- Summer ratings, placements, tiers, and preseason opinions contribute nothing.
- No initial `team_rating_snapshots` rows are needed. The first completed, non-forfeit regular-season result initializes both teams at 1500 and records the first movement.
- BYEs and forfeits do not produce performance movement.
- A team with no played result remains unrated in the public table instead of receiving a fabricated rank.

## Implementation

1. Keep `team_rating_snapshots` empty for competitions 3 and 4 before opening play.
2. Import league results with exact `competition_id`, format, `competition_phase='regular_season'`, round, and stable team identity.
3. Calculate each competition independently with `FR-ELO-1.0`.
4. Persist snapshots only after verified match evidence exists, using the match row as provenance.
5. Validate that no snapshot for competition 3 or 4 references a Summer match or opponent mapping.

Owner approval still required: confirm the neutral 1500 starting rating and that tiers will not seed Fall ratings.
