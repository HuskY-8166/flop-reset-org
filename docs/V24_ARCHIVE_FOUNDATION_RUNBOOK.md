# V2.4 Archive Foundation Runbook

This runbook covers the additive season/archive foundation introduced by:

`supabase/migrations/202609120015_v24_archive_foundation.sql`

It does not authorize a competitive reset, bracket seed, Rivalry sync, deploy,
or production data cleanup.

## Release order

1. Confirm migrations through `202609050014_atomic_rivalry_playoff_sync.sql`
   have been reviewed and applied in the target non-production environment.
2. Capture current counts for competitions, competition entries, roster members,
   series, matches, player stats, playoff brackets, and playoff matches.
3. Apply `202609120015_v24_archive_foundation.sql` in non-production.
4. Confirm every competition with a complete league/circuit/year identity has a
   `season_id`. Review `public.v24_season_reconciliation`; do not guess rows that
   remain there.
5. Confirm the generated Summer identity is:
   `the-rivalry-summer-circuit-2026` with status `completed`.
6. Verify the old application still renders after the additive migration.
7. Deploy the V2.4 application to preview and test the archive at 390, 768,
   1024, and 1440 CSS pixels.
8. Populate verified event roster snapshots and placement fields. Leave unknown
   values NULL.
9. Add awards as private rows first. Set `is_public = true` only together with an
   approval timestamp after the recipient and evidence have been reviewed.
10. Re-run lint, TypeScript, all tests, production build, public browser QA, and
    authenticated Admin QA before production release.

## Required post-migration checks

```sql
select season_id, league_name, season_name, season_year, slug, status
from public.competition_seasons
order by season_year desc, season_name;

select id, name, format, season_id
from public.competitions
order by id;

select *
from public.v24_season_reconciliation
order by competition_id;

select season_id, count(*) as format_competitions
from public.competitions
where season_id is not null
group by season_id
order by season_id;

select season_id, count(*) filter (where is_public) as public_awards,
  count(*) filter (where is_public and approved_at is null) as invalid_public_awards
from public.season_awards
group by season_id;
```

Expected invariants:

- The migration changes no existing series, games, player statistics, roster
  membership, playoff topology, or league result.
- Format competitions remain separate children of one season.
- Summer Circuit 2026 is one season containing its 2v2 and 3v3 competition rows.
- Unknown official placements remain NULL and render as unavailable.
- Unapproved awards never appear in the public view.
- A blank/test-only bracket may be withheld from the archive UI, but no bracket
  row is deleted by this migration.

## Current data items requiring operator review

- The connected database does not yet expose `public_competition_seasons`, so
  local pages currently use the legacy identity grouping fallback and display
  the old competition status.
- Verified final placements have not yet been entered.
- Event-specific Flop Reset roster snapshots are missing for the current Summer
  entries.
- No Summer awards have been approved.
- At least one empty duplicate T4 bracket container exists in current data. The
  archive hides fully blank bracket structures, but the row should be reviewed
  before any production cleanup. Do not delete it automatically.
