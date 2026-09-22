import { createClient } from '@supabase/supabase-js'
import { buildRivalryPlayoffSyncPlan, parseRivalryPlayoffBracketHtml, type ExistingPlayoffMatch } from '@/lib/rivalryPlayoffs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COMPETITION_ID = 2
const DEFAULT_SOURCE_URL = 'https://therivalry.gg/competitions/6a110a8ee2b67775afcb5921'

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

function rivalryBracketUrl() {
  const configured = process.env.RIVALRY_PLAYOFF_SOURCE_URL || DEFAULT_SOURCE_URL
  const url = new URL(configured)
  if (url.protocol !== 'https:' || url.hostname !== 'therivalry.gg' || !/^\/competitions\/[^/]+\/?$/.test(url.pathname)) {
    throw new Error('RIVALRY_PLAYOFF_SOURCE_URL must be a public therivalry.gg competition URL.')
  }
  url.pathname = `${url.pathname.replace(/\/$/, '')}/tab/bracket`
  return url
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Server-side Supabase configuration is incomplete.' }, { status: 503 })
  }

  let sourceResponse: Response
  try {
    sourceResponse = await fetch(rivalryBracketUrl(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'FlopResetPlayoffSync/2.4 (+https://flop-reset-org.vercel.app)',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Rivalry request failed.'
    return Response.json({ error: message, applied: 0 }, { status: 502 })
  }

  if (!sourceResponse.ok || new URL(sourceResponse.url).hostname !== 'therivalry.gg') {
    return Response.json({ error: `Rivalry returned HTTP ${sourceResponse.status}; no changes were written.`, applied: 0 }, { status: 502 })
  }
  const html = await sourceResponse.text()
  if (html.length > 1_000_000) return Response.json({ error: 'Rivalry bracket response exceeded the safe size limit.', applied: 0 }, { status: 413 })

  const parsed = parseRivalryPlayoffBracketHtml(html)
  if (parsed.errors.length) return Response.json({ error: 'Rivalry bracket validation failed.', details: parsed.errors, applied: 0 }, { status: 422 })

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const [{ data: brackets, error: bracketError }, { data: entries, error: entryError }] = await Promise.all([
    client.from('playoff_brackets').select('bracket_id,tier,playoff_matches(*)').eq('competition_id', COMPETITION_ID).in('tier', ['4', '5', '6']),
    client.from('competition_entries').select('entry_id,tier,display_name_snapshot').eq('competition_id', COMPETITION_ID),
  ])
  if (bracketError || entryError) {
    return Response.json({ error: bracketError?.message || entryError?.message, applied: 0 }, { status: 500 })
  }

  const existing = (brackets ?? []).flatMap((bracket) =>
    ((bracket.playoff_matches ?? []) as Omit<ExistingPlayoffMatch, 'tier'>[]).map((match) => ({ ...match, tier: String(bracket.tier) })),
  )
  const expectedTiers = new Set(['4', '5', '6'])
  if (brackets?.length !== 3 || new Set(brackets.map((bracket) => String(bracket.tier))).size !== 3 || brackets.some((bracket) => !expectedTiers.has(String(bracket.tier)))) {
    return Response.json({ error: 'Local T4/T5/T6 bracket set is incomplete or ambiguous.', applied: 0 }, { status: 409 })
  }
  if (existing.length !== 48) return Response.json({ error: `Local bracket has ${existing.length} matches; expected 48.`, applied: 0 }, { status: 409 })

  const plan = buildRivalryPlayoffSyncPlan(parsed.matches, existing, entries ?? [])
  if (plan.conflicts.length) {
    return Response.json({ error: 'Rivalry changes conflict with preserved local playoff data.', conflicts: plan.conflicts, applied: 0 }, { status: 409 })
  }

  const { data: appliedRows, error: applyError } = await client.rpc('apply_rivalry_playoff_sync', {
    proposed_updates: plan.updates.map((update) => ({
      playoff_match_id: update.playoffMatchId,
      expected_status: update.expectedStatus,
      expected: update.expected,
      patch: update.patch,
    })),
  })
  if (applyError) {
    return Response.json({ error: applyError.message, applied: 0, appliedMatchIds: [] }, { status: 409 })
  }
  const applied = (appliedRows ?? []).map((row: { playoff_match_id: number }) => Number(row.playoff_match_id))

  return Response.json({
    ok: true,
    sourceMatches: parsed.matches.length,
    applied: applied.length,
    appliedMatchIds: applied,
    checkedAt: new Date().toISOString(),
  })
}
