import { createHash } from 'node:crypto'
import { buildDirectoryReconciliation, buildLeagueSyncPreview, parseRivalryCompetitionHtml, sourceSnapshotCanApply } from '@/lib/leagueDirectory'
import { requireSiteAdmin } from '@/lib/adminServer'

export const runtime = 'nodejs'

const lastFetch = new Map<string, number>()

function validatedRivalryUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? ''))
    if (url.protocol !== 'https:' || url.hostname !== 'therivalry.gg' || !/^\/competitions\/[^/]+\/?$/.test(url.pathname)) return null
    return url
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const { client, user, error: authError } = await requireSiteAdmin(request)
  if (authError || !user) return Response.json({ error: authError }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { competitionId?: unknown; sourceUrl?: unknown }
  const competitionId = Number(body.competitionId)
  const sourceUrl = validatedRivalryUrl(body.sourceUrl)
  if (!Number.isInteger(competitionId) || competitionId < 1 || !sourceUrl) {
    return Response.json({ error: 'Select a competition and provide a public Rivalry competition URL.' }, { status: 400 })
  }

  const throttleKey = `${user.id}:${competitionId}`
  const elapsed = Date.now() - (lastFetch.get(throttleKey) ?? 0)
  if (elapsed < 10_000) return Response.json({ error: `Wait ${Math.ceil((10_000 - elapsed) / 1000)} seconds before fetching this source again.` }, { status: 429 })
  lastFetch.set(throttleKey, Date.now())

  const competitionExternalId = sourceUrl.pathname.split('/').filter(Boolean).at(-1)!
  const sourceProbe = await client.from('competition_sources').select('*').eq('competition_id', competitionId).eq('provider', 'rivalry').maybeSingle()
  if (sourceProbe.error && /does not exist|schema cache/i.test(sourceProbe.error.message)) {
    return Response.json({ error: 'V2.3.9 league-directory migration is required before source preview.' }, { status: 409 })
  }

  let response: Response
  try {
    response = await fetch(sourceUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'FlopResetLeagueDirectory/2.3.9 (+https://flop-reset-org.vercel.app)',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Source request failed.'
    if (sourceProbe.data?.competition_source_id) {
      await client.from('competition_sources').update({ source_status: 'error', last_attempted_at: new Date().toISOString(), last_error: message }).eq('competition_source_id', sourceProbe.data.competition_source_id)
    }
    return Response.json({ error: `Rivalry source unavailable: ${message}` }, { status: 502 })
  }

  if (!response.ok || new URL(response.url).hostname !== 'therivalry.gg') {
    return Response.json({ error: `Rivalry returned HTTP ${response.status}; no directory changes were written.` }, { status: 502 })
  }
  const html = await response.text()
  if (html.length > 5_000_000) return Response.json({ error: 'Rivalry response exceeded the safe parser size limit.' }, { status: 413 })

  const parsed = parseRivalryCompetitionHtml(html, sourceUrl.toString())
  if (!sourceSnapshotCanApply(parsed.snapshot, parsed.errors) || !parsed.snapshot) {
    if (sourceProbe.data?.competition_source_id) {
      await client.from('competition_sources').update({ source_status: 'error', last_attempted_at: new Date().toISOString(), last_error: parsed.errors.join(' · ') }).eq('competition_source_id', sourceProbe.data.competition_source_id)
    }
    return Response.json({ error: 'Rivalry markup did not pass validation. Last good directory data was preserved.', validationErrors: parsed.errors }, { status: 422 })
  }

  const sourceRecord = {
    competition_id: competitionId,
    provider: 'rivalry',
    external_competition_id: competitionExternalId,
    source_url: sourceUrl.toString(),
    source_status: 'previewed',
    parser_version: parsed.snapshot.parserVersion,
    last_attempted_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }
  const { data: source, error: sourceError } = await client.from('competition_sources')
    .upsert(sourceRecord, { onConflict: 'competition_id,provider' }).select().single()
  if (sourceError || !source) return Response.json({ error: sourceError?.message ?? 'Competition source could not be saved.' }, { status: 500 })

  const [{ data: currentEntries, error: entryError }, leagueMatches, aliases] = await Promise.all([
    client.from('competition_entries').select('*, competition_roster_members(*)').eq('competition_id', competitionId),
    client.from('league_matches').select('team_a, team_b').eq('competition_id', competitionId),
    client.from('opponent_aliases').select('alias'),
  ])
  if (entryError) return Response.json({ error: entryError.message }, { status: 500 })
  const preview = buildLeagueSyncPreview(parsed.snapshot, currentEntries ?? [])
  const reconciliation = buildDirectoryReconciliation({
    snapshot: parsed.snapshot,
    currentEntries: currentEntries ?? [],
    powerTeamNames: (leagueMatches.data ?? []).flatMap((match) => [match.team_a, match.team_b]).filter((value): value is string => Boolean(value)),
    aliasNames: (aliases.data ?? []).map((row) => row.alias).filter((value): value is string => Boolean(value)),
  })
  const normalized = JSON.stringify(parsed.snapshot)
  const contentHash = createHash('sha256').update(normalized).digest('hex')
  const { data: snapshot, error: snapshotError } = await client.from('external_source_snapshots').upsert({
    competition_source_id: source.competition_source_id,
    provider: 'rivalry', source_type: 'competition', source_external_id: competitionExternalId,
    source_url: sourceUrl.toString(), content_hash: contentHash,
    parser_version: parsed.snapshot.parserVersion, normalized_payload: parsed.snapshot,
    status: 'preview', validation_errors: [],
  }, { onConflict: 'provider,source_external_id,content_hash' }).select().single()
  if (snapshotError || !snapshot) return Response.json({ error: snapshotError?.message ?? 'Preview snapshot could not be stored.' }, { status: 500 })

  return Response.json({ snapshotId: snapshot.snapshot_id, source, snapshot: parsed.snapshot, preview, reconciliation })
}
