/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatPublicDate, getGameOutcome, getSeriesOutcome } from '@/lib/results'
export const dynamic = 'force-dynamic'

export default async function Matches({ searchParams }: { searchParams: Promise<{ format?: string; team?: string }> }) {
  const query = await searchParams
  const { data: rawSeries, error } = await supabase.from('series').select('series_id, opponent_name, best_of, series_date, notes, teams ( name, format ), matches ( * )').order('series_date', { ascending: false })
  const formats = [...new Set((rawSeries ?? []).map((s:any) => s.teams?.format).filter(Boolean))]
  const teams = [...new Set((rawSeries ?? []).map((s:any) => s.teams?.name).filter(Boolean))]
  const format = query.format && formats.includes(query.format) ? query.format : 'All'
  const team = query.team && teams.includes(query.team) ? query.team : 'All'
  const series = (rawSeries ?? []).filter((s:any) => (format === 'All' || s.teams?.format === format) && (team === 'All' || s.teams?.name === team))
  const href = (nextFormat:string,nextTeam:string) => { const p=new URLSearchParams(); if(nextFormat!=='All')p.set('format',nextFormat); if(nextTeam!=='All')p.set('team',nextTeam); return `/matches${p.size?`?${p}`:''}` }

  return <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
    <header className="mb-8 rounded-3xl border border-neutral-800 bg-gradient-to-br from-[#171717] to-[#0d0d0d] p-6 md:p-9"><div className="text-xs font-bold uppercase tracking-[.22em] text-purple-400">Results archive</div><h1 className="mt-2 text-4xl font-black md:text-6xl">Match History</h1><p className="mt-2 max-w-2xl text-neutral-400">Series-first results with game scores available on demand. Every result links to its full player box score.</p></header>
    <div className="mb-8 flex flex-col gap-3"><div className="flex flex-wrap gap-2">{['All',...formats].map((f) => <Link key={f} href={href(f,team)} className={`rounded-full px-3 py-2 text-sm font-semibold no-underline ${format===f?'bg-purple-700 text-white':'border border-neutral-800 bg-[#151515] text-neutral-400'}`}>{f}</Link>)}</div><div className="flex flex-wrap gap-2">{['All',...teams].map((t) => <Link key={t} href={href(format,t)} className={`rounded-full px-3 py-2 text-sm font-semibold no-underline ${team===t?'bg-neutral-700 text-white':'border border-neutral-800 bg-[#151515] text-neutral-400'}`}>{t==='All'?'All Teams':t}</Link>)}</div></div>
    {error && <div className="rounded-xl border border-red-900 bg-red-950/20 p-4 text-red-300">Results could not be loaded: {error.message}</div>}
    {!error && series.length===0 && <div className="rounded-xl border border-neutral-800 bg-[#111] p-6 text-neutral-500">No results match these filters.</div>}
    <div className="space-y-4">{series.map((s:any) => { const games=s.matches??[]; const outcome=getSeriesOutcome(games); return <article key={s.series_id} className={`rounded-2xl border border-neutral-800 border-l-4 bg-[#111] p-5 ${outcome.won?'border-l-emerald-500':outcome.lost?'border-l-red-500':'border-l-neutral-500'}`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="text-xs uppercase tracking-wide text-neutral-500">{s.teams?.format} · {formatPublicDate(s.series_date)}</div><div className="mt-1 text-lg font-bold text-white"><Link href={`/teams/${encodeURIComponent(s.teams?.name??'')}`} className="text-white hover:underline">{s.teams?.name}</Link> <span className="text-neutral-600">vs</span> {s.opponent_name}</div></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-sm font-black ${outcome.won?'bg-emerald-950 text-emerald-400':outcome.lost?'bg-red-950 text-red-400':'bg-neutral-800 text-neutral-300'}`}>{outcome.result} {outcome.displayRecord}</span><Link href={`/matches/${s.series_id}`} className="rounded-lg border border-purple-800 px-3 py-2 text-sm text-purple-300 no-underline hover:bg-purple-950">Full box score →</Link></div></div><details className="mt-4 border-t border-neutral-800 pt-3"><summary className="cursor-pointer text-sm text-neutral-500">View {games.length} game scores</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{games.map((g:any,i:number)=>{const game=getGameOutcome(g);return <div key={g.match_id} className="flex justify-between rounded-lg bg-black/20 px-3 py-2 text-sm text-neutral-400"><span>Game {i+1}</span><span>{game.result} · {game.displayScore}{game.isForfeit?' · FORFEIT':''}</span></div>})}</div></details>{s.notes&&<p className="mt-3 text-xs text-neutral-600">{s.notes}</p>}</article>})}</div>
  </main>
}
