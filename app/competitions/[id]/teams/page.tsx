/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { EmptyState, PageHero, SectionHeader } from '@/components/ui'
import { competitionIdentity } from '@/lib/competitions'
import { calculateEloWithHistory, type LeagueMatch } from '@/lib/elo'
import { normalizeLeagueIdentity, safePublicImageUrl } from '@/lib/leagueDirectory'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function CompetitionTeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; tier?: string; status?: string; power?: string }>
}) {
  const { id } = await params
  const filters = await searchParams
  const competitionId = Number(id)
  const [{ data: competition }, entryResult, rosterResult, leagueResult, pageResult] = await Promise.all([
    supabase.from('competitions').select('*').eq('id', competitionId).maybeSingle(),
    supabase.from('public_competition_entries').select('*').eq('competition_id', competitionId).order('display_name_snapshot'),
    supabase.from('public_competition_roster_members').select('entry_id, is_current').eq('competition_id', competitionId),
    supabase.from('league_matches').select('id, competition_id, format, round, tier, team_a, team_b, score_a, score_b, status, match_date, batch_label').eq('competition_id', competitionId),
    supabase.from('public_page_content_overrides').select('*').in('page_key', ['league-directory', `competition:${competitionId}:teams`]),
  ])

  if (!competition) return <main className="mx-auto max-w-5xl px-4 py-16"><EmptyState title="Competition not found" description="This competition is not available." actionHref="/competitions" actionLabel="Back to competitions" /></main>
  const identity = competitionIdentity(competition)
  const pageOverride = (pageResult.data ?? []).find((row) => row.page_key === `competition:${competitionId}:teams`) ?? (pageResult.data ?? []).find((row) => row.page_key === 'league-directory')
  if (pageOverride?.is_visible === false) return <main className="mx-auto max-w-5xl px-4 py-16"><EmptyState title="Team directory unavailable" description="This competition directory is currently hidden by an administrator." actionHref={`/competitions/${competitionId}`} actionLabel="Competition overview" /></main>
  const entries = (entryResult.data ?? []) as any[]
  const rosterCounts = new Map<number, number>()
  for (const member of rosterResult.data ?? []) if (member.is_current) rosterCounts.set(Number(member.entry_id), (rosterCounts.get(Number(member.entry_id)) ?? 0) + 1)
  const leagueMatches = (leagueResult.data ?? []) as LeagueMatch[]
  const ratingEngine = leagueMatches.length ? calculateEloWithHistory(leagueMatches) : null
  const powerByName = new Map((ratingEngine?.teamSummaries ?? []).map((team) => [normalizeLeagueIdentity(team.team), team]))
  const tiers = [...new Set(entries.map((entry) => entry.tier).filter(Boolean))].sort((a, b) => Number(a) - Number(b))
  const needle = normalizeLeagueIdentity(filters.q)
  const visible = entries.filter((entry) => {
    if (needle && !normalizeLeagueIdentity(entry.display_name_snapshot).includes(needle)) return false
    if (filters.tier && String(entry.tier ?? '') !== filters.tier) return false
    if (filters.status && String(entry.competitive_status ?? '') !== filters.status) return false
    if (filters.power === 'yes' && !entry.is_power_tracked) return false
    if (filters.power === 'no' && entry.is_power_tracked) return false
    return true
  })

  return <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-10 md:px-8 md:py-14">
    <PageHero eyebrow={`${identity.league} · ${identity.format}`} title={pageOverride?.title_override || 'League Team Directory'} description={pageOverride?.subtitle_override || `${identity.seasonLabel} · ${competition.region || 'Region TBD'}. Registered, active, tiered, withdrawn, and Power-tracked states remain explicit.`}>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full border border-neutral-700 px-3 py-1">{entries.length} competition entries</span><span className="rounded-full border border-neutral-700 px-3 py-1">{visible.length} shown</span><Link href={`/competitions/${competitionId}`} className="rounded-full border border-purple-800 px-3 py-1 text-purple-300 no-underline">Competition overview</Link></div>
    </PageHero>
    {pageOverride?.manual_callout && <div className="mt-5 rounded-xl border border-purple-800 bg-purple-950/20 p-4 text-sm text-purple-100">{pageOverride.manual_callout}</div>}

    <form className="mt-7 grid min-w-0 gap-3 rounded-2xl border border-neutral-800 bg-[#111] p-4 sm:grid-cols-2 lg:grid-cols-5">
      <label className="min-w-0 text-xs font-bold uppercase tracking-wide text-neutral-500">Search<input name="q" defaultValue={filters.q ?? ''} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-neutral-700 bg-black/30 px-3 text-white" placeholder="Team name" /></label>
      <Filter label="Tier" name="tier" value={filters.tier}><option value="">All tiers</option>{tiers.map((tier) => <option key={tier} value={tier}>Tier {tier}</option>)}</Filter>
      <Filter label="Status" name="status" value={filters.status}><option value="">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option><option value="withdrawn">Withdrawn</option></Filter>
      <Filter label="Power tracked" name="power" value={filters.power}><option value="">All entries</option><option value="yes">Tracked</option><option value="no">Not tracked</option></Filter>
      <button className="min-h-11 self-end rounded-lg bg-purple-700 px-4 font-black text-white">Filter teams</button>
    </form>

    <section className="mt-10"><SectionHeader eyebrow="Competition field" title="Teams" description="A verified entry can appear before Flop Reset has played it. Power and meeting data appear only when trustworthy evidence exists." />
      {entryResult.error || rosterResult.error ? <EmptyState title="League directory migration required" description="Competition results remain available, but the V2.3.9 structural migration must be applied before directory entries can render." /> : visible.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map((entry) => {
        const power = powerByName.get(normalizeLeagueIdentity(entry.display_name_snapshot))
        const rosterCount = rosterCounts.get(Number(entry.entry_id)) ?? 0
        const resultCount = leagueMatches.filter((match) => normalizeLeagueIdentity(match.team_a) === normalizeLeagueIdentity(entry.display_name_snapshot) || normalizeLeagueIdentity(match.team_b) === normalizeLeagueIdentity(entry.display_name_snapshot)).length
        const canonical = Boolean(entry.fr_team_id || entry.opponent_id)
        const logoUrl = safePublicImageUrl(entry.logo_url_snapshot)
        return <Link key={entry.entry_id} href={`/league/teams/${entry.slug}`} className="min-w-0 rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-700">
          <div className="flex min-w-0 items-start gap-4"><div aria-label={`${entry.display_name_snapshot} logo`} style={logoUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.2),rgba(0,0,0,.2)),url(${logoUrl})`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined} className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl font-black ${entry.fr_team_id ? 'bg-purple-700' : 'bg-neutral-800'}`}>{logoUrl ? <span className="sr-only">{entry.display_name_snapshot}</span> : String(entry.display_name_snapshot).split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase()}</div><div className="min-w-0"><h2 className="break-words text-xl font-black">{entry.display_name_snapshot}</h2><div className="mt-1 text-xs text-neutral-500">{entry.tier ? `Tier ${entry.tier}` : 'Tier pending'} · {entry.competitive_status}</div></div></div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center"><Metric label="Roster" value={rosterCount || '—'} /><Metric label="Results" value={resultCount || '—'} /><Metric label="Power" value={power?.overallRank ? `#${power.overallRank}` : '—'} /></div>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]"><Badge active>League Entry</Badge><Badge active={rosterCount > 0}>Roster</Badge><Badge active={Boolean(power)}>Power</Badge><Badge active={canonical}>{entry.fr_team_id ? 'FR Team' : canonical ? 'Canonical' : 'Identity pending'}</Badge></div>
        </Link>
      })}</div> : <EmptyState title="No teams match these filters" description="Try clearing the tier, status, Power, or search filter." />}
    </section>
  </main>
}

function Filter({ label, name, value, children }: { label: string; name: string; value?: string; children: React.ReactNode }) {
  return <label className="min-w-0 text-xs font-bold uppercase tracking-wide text-neutral-500">{label}<select name={name} defaultValue={value ?? ''} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-neutral-700 bg-[#181818] px-3 text-white">{children}</select></label>
}
function Metric({ label, value }: { label: string; value: React.ReactNode }) { return <div className="rounded-lg bg-black/25 p-2"><div className="text-[10px] uppercase text-neutral-600">{label}</div><div className="mt-1 font-black">{value}</div></div> }
function Badge({ active, children }: { active: boolean; children: React.ReactNode }) { return <span className={`rounded-full border px-2 py-1 ${active ? 'border-emerald-800 text-emerald-300' : 'border-neutral-800 text-neutral-600'}`}>{children}</span> }
