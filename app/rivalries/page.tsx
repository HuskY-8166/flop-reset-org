/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

type Rivalry = { opponent: string; seriesWins: number; seriesLosses: number; gameWins: number; gameLosses: number; series: number; latestId: number; latestDate: string }

export default async function Rivalries({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  const query = await searchParams
  const { data: rawSeries, error } = await supabase.from('series').select('series_id, opponent_name, series_date, teams ( name, format ), matches ( flop_reset_score, opponent_score )').order('series_date', { ascending: false })
  const formats = [...new Set((rawSeries ?? []).map((series: any) => series.teams?.format).filter(Boolean))]
  const selected = query.format && formats.includes(query.format) ? query.format : 'All'
  const map = new Map<string,Rivalry>()
  ;(rawSeries ?? []).filter((series: any) => selected === 'All' || series.teams?.format === selected).forEach((series: any) => {
    const opponent = series.opponent_name ?? 'Unknown opponent', games = series.matches ?? []
    const gameWins = games.filter((game: any) => game.flop_reset_score > game.opponent_score).length
    const gameLosses = games.filter((game: any) => game.flop_reset_score < game.opponent_score).length
    const row = map.get(opponent) ?? { opponent, seriesWins: 0, seriesLosses: 0, gameWins: 0, gameLosses: 0, series: 0, latestId: series.series_id, latestDate: series.series_date ?? '' }
    row.series++; row.gameWins += gameWins; row.gameLosses += gameLosses
    if (gameWins > gameLosses) row.seriesWins++; else if (gameLosses > gameWins) row.seriesLosses++
    map.set(opponent,row)
  })
  const rivalries = [...map.values()].sort((a,b) => b.series - a.series || b.gameWins+b.gameLosses-(a.gameWins+a.gameLosses))

  return <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
    <header className="mb-8 rounded-3xl border border-neutral-800 bg-gradient-to-br from-[#171717] to-[#0d0d0d] p-6 md:p-9"><div className="text-xs font-bold uppercase tracking-[.22em] text-purple-400">Head-to-head archive</div><h1 className="mt-2 text-4xl font-black md:text-6xl">Rivalries</h1><p className="mt-2 max-w-2xl text-neutral-400">Every repeat opponent, with series history kept separate from individual game results.</p></header>
    <nav className="mb-8 flex gap-2">{['All',...formats].map((format) => <Link key={format} href={format === 'All' ? '/rivalries' : `/rivalries?format=${format}`} className={`rounded-full px-4 py-2 text-sm font-bold no-underline ${selected === format ? 'bg-purple-700 text-white' : 'border border-neutral-800 bg-[#151515] text-neutral-400'}`}>{format}</Link>)}</nav>
    {error && <div className="rounded-xl border border-red-900 bg-red-950/20 p-4 text-red-300">History could not be loaded: {error.message}</div>}
    {!error && rivalries.length === 0 && <div className="rounded-xl border border-neutral-800 bg-[#111] p-6 text-neutral-500">No {selected === 'All' ? '' : `${selected} `}opponent history has been recorded yet.</div>}
    <div className="grid gap-4 md:grid-cols-2">{rivalries.map((row) => <article key={row.opponent} className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><div className="flex items-start justify-between gap-4"><div><div className="text-xs uppercase tracking-wide text-neutral-600">Opponent</div><h2 className="mt-1 text-2xl font-black text-white">{row.opponent}</h2><div className="mt-1 text-xs text-neutral-500">Last met {row.latestDate || 'date unavailable'}</div></div><div className="rounded-lg border border-neutral-800 bg-black/20 px-3 py-2 text-center"><div className="text-xl font-black text-purple-300">{row.series}</div><div className="text-[10px] uppercase text-neutral-600">Series</div></div></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-neutral-800 p-3"><div className="text-xs uppercase text-neutral-600">Series Record</div><div className="mt-1 text-xl font-bold">{row.seriesWins}–{row.seriesLosses}</div></div><div className="rounded-xl border border-neutral-800 p-3"><div className="text-xs uppercase text-neutral-600">Game Record</div><div className="mt-1 text-xl font-bold">{row.gameWins}–{row.gameLosses}</div></div></div><Link href={`/matches/${row.latestId}`} className="mt-4 inline-block text-sm text-purple-300 hover:underline">View latest series →</Link></article>)}</div>
  </main>
}
