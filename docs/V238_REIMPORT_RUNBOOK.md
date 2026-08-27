# V2.3.8 Summer reimport runbook

1. Export the tables named in the reset SQL header.
2. Run `202608250009_pre_reset_diagnostics.sql` and save its output.
3. Confirm Admin → Data Health says **READY FOR CONTROLLED RESET**.
4. Run the complete guarded reset SQL once in Supabase.
5. Confirm the returned competitive counts are zero and structural counts are nonzero.
6. Open Admin → Playoffs and confirm bracket creation/editing is available; create only verified official brackets and routes.
7. Open Admin → Import CSV.
8. Import original Summer `players-games.csv` files oldest to newest.
9. Optionally attach each matching `players.csv` as an aggregate validator.
10. Manually confirm opponent, date, and the scheduled odd best-of value.
11. Confirm only previews marked **SAFE NEW IMPORT**.
12. Recreate legitimate forfeits with Add Result; do not upload fake CSVs.
13. Link verified FR playoff series from Admin → Playoffs and use explicit advancement actions.
14. After each batch, refresh Data Health and inspect Matches, Stats, Records, and Rivalries.
15. Compare the completed rebuild with the baseline audit without forcing its totals during partial progress.
16. Only after FR history is verified, reimport the league result slate chronologically and rebuild Power.

For a forfeit, the expected result is one official series, public score 0-0,
zero game rows, and zero player-stat rows.
