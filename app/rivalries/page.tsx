/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { EmptyState, PageHero, SectionHeader } from '@/components/ui'
import { formatPublicDate, getSeriesOutcome } from '@/lib/results'
import { normalizeIdentity } from '@/lib/stats'
import { supabase } from '@/lib/supabase'
import { buildOpponentIdentityIndex } from '@/lib/opponents'

export const dynamic = 'force-dynamic'

type Rivalry = {
  key: string
  opponent: string
  aliases: Set<string>
  seriesWins: number
  seriesLosses: number
  gameWins: number
  gameLosses: number
  series: number
  latestId: number
  latestDate: string
  formats: Set<string>
}

export default async function Rivalries({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  const query = await searchParams
  const [{ data: rawSeries, error }, { data: opponents }, { data: opponentAliases }] = await Promise.all([
    supabase.from('series').select('series_id, opponent_id, opponent_name, series_date, notes, teams ( name, format ), matches ( * )').order('series_date', { ascending: false }),
    supabase.from('opponents').select('opponent_id, canonical_name'),
    supabase.from('opponent_aliases').select('opponent_id, alias'),
  ])
  const identityIndex = buildOpponentIdentityIndex(opponents ?? [], opponentAliases ?? [])

  const formats = [...new Set((rawSeries ?? []).map((series: any) => series.teams?.format).filter(Boolean))]
  const selected = query.format && formats.includes(query.format) ? query.format : 'All'
  const map = new Map<string, Rivalry>()

  for (const series of (rawSeries ?? []).filter((entry: any) => selected === 'All' || entry.teams?.format === selected) as any[]) {
    const opponentId = Number(series.opponent_id)
    const identity = identityIndex.resolve({ opponentId, snapshotName: series.opponent_name })
    const opponent = identity?.canonicalName ?? series.opponent_name ?? 'Unknown opponent'
    const key = identity ? `opponent:${identity.opponentId}` : normalizeIdentity(opponent)
    const outcome = getSeriesOutcome(series.matches ?? [], series)
    const row = map.get(key) ?? {
      key,
      opponent,
      aliases: new Set<string>(),
      seriesWins: 0,
      seriesLosses: 0,
      gameWins: 0,
      gameLosses: 0,
      series: 0,
      latestId: series.series_id,
      latestDate: series.series_date ?? '',
      formats: new Set<string>(),
    }

    row.aliases.add(series.opponent_name ?? opponent)
    for (const alias of identity?.aliases ?? []) row.aliases.add(alias)
    if (series.teams?.format) row.formats.add(series.teams.format)
    row.series += 1
    row.gameWins += outcome.wins
    row.gameLosses += outcome.losses
    if (outcome.won) row.seriesWins += 1
    else if (outcome.lost) row.seriesLosses += 1
    map.set(key, row)
  }

  const rivalries = [...map.values()].sort((a, b) => b.series - a.series || (b.gameWins + b.gameLosses) - (a.gameWins + a.gameLosses))

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <PageHero eyebrow="Head-to-head archive" title="Rivalries" description="Every opponent across every competition, with format-aware series and game records. Confirmed alternate spellings remain connected without speculatively merging different teams." />
      <nav className="my-8 flex flex-wrap gap-2" aria-label="Rivalry format">
        {['All', ...formats].map((format) => <Link key={format} href={format === 'All' ? '/rivalries' : `/rivalries?format=${format}`} aria-current={selected === format ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-bold no-underline ${selected === format ? 'bg-purple-700 text-white' : 'border border-neutral-800 bg-[#151515] text-neutral-400'}`}>{format}</Link>)}
      </nav>
      {error ? <div className="rounded-xl border border-red-900 bg-red-950/20 p-4 text-red-300">Something went wrong while loading rivalry history. Please try again shortly.</div> : null}
      {!error && !rivalries.length ? <EmptyState title="No opponent history recorded" description={`No ${selected === 'All' ? '' : `${selected} `}rivalry data is available yet.`} /> : null}
      {rivalries.length ? <section><SectionHeader eyebrow="Global opponent identities" title="Opponent Ledger" /><div className="grid gap-4 md:grid-cols-2">{rivalries.map((row) => <Link key={row.key} href={`/rivalries/${encodeURIComponent(row.opponent)}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-800"><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-black">{row.opponent}</h2><div className="mt-1 text-xs text-neutral-500">Last met {formatPublicDate(row.latestDate)} · {[...row.formats].join(' / ')}</div>{row.aliases.size > 1 ? <div className="mt-2 text-xs text-neutral-600">Recorded names: {[...row.aliases].join(', ')}</div> : null}</div><div className="rounded-lg border border-neutral-800 bg-black/20 px-3 py-2 text-center"><div className="text-xl font-black text-purple-300">{row.series}</div><div className="text-[10px] uppercase text-neutral-600">Series</div></div></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-neutral-800 p-3"><div className="text-xs uppercase text-neutral-600">Series Record</div><div className="mt-1 text-xl font-bold">{row.seriesWins}–{row.seriesLosses}</div></div><div className="rounded-xl border border-neutral-800 p-3"><div className="text-xs uppercase text-neutral-600">Game Record</div><div className="mt-1 text-xl font-bold">{row.gameWins}–{row.gameLosses}</div></div></div><div className="mt-4 text-sm text-purple-300">Open rivalry archive →</div></Link>)}</div></section> : null}
    </main>
  )
}
