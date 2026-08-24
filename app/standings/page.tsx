/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export default async function Standings({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  const query = await searchParams
  const { data: rawTeams, error } = await supabase.from('teams').select(`id, name, format, series ( series_id, matches ( flop_reset_score, opponent_score, is_forfeit ) )`).order('name')
  const formats = [...new Set((rawTeams ?? []).map((team) => team.format).filter(Boolean))]
  const selected = query.format && formats.includes(query.format) ? query.format : 'All'
  const standings = (rawTeams ?? []).filter((team) => selected === 'All' || team.format === selected).map((team) => {
    let seriesWon = 0, seriesLost = 0, gamesWon = 0, gamesLost = 0
    ;(team.series as any[] | null)?.forEach((series) => {
      const games = (series.matches as any[] | null) ?? []
      const won = games.filter((game) => game.flop_reset_score > game.opponent_score).length
      const lost = games.filter((game) => game.flop_reset_score < game.opponent_score).length
      gamesWon += won; gamesLost += lost
      if (won > lost) seriesWon++; else if (lost > won) seriesLost++
    })
    return { ...team, seriesWon, seriesLost, gamesWon, gamesLost, seriesPct: seriesWon + seriesLost ? seriesWon / (seriesWon + seriesLost) : 0 }
  }).sort((a,b) => b.seriesPct - a.seriesPct || b.seriesWon - a.seriesWon || b.gamesWon - a.gamesWon)

  return <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
    <header className="mb-8 rounded-3xl border border-neutral-800 bg-gradient-to-br from-[#171717] to-[#0d0d0d] p-6 md:p-9">
      <div className="text-xs font-bold uppercase tracking-[.22em] text-purple-400">Team performance</div><h1 className="mt-2 text-4xl font-black md:text-6xl">Standings</h1>
      <p className="mt-2 max-w-2xl text-neutral-400">Flop Reset squad results across the recorded archive. Series Record and Game Record are shown separately.</p>
    </header>
    <nav className="mb-8 flex gap-2">{['All',...formats].map((format) => <Link key={format} href={format === 'All' ? '/standings' : `/standings?format=${format}`} className={`rounded-full px-4 py-2 text-sm font-bold no-underline ${selected === format ? 'bg-purple-700 text-white' : 'border border-neutral-800 bg-[#151515] text-neutral-400'}`}>{format}</Link>)}</nav>
    {error && <div className="rounded-xl border border-red-900 bg-red-950/20 p-4 text-red-300">Standings could not be loaded: {error.message}</div>}
    {!error && standings.length === 0 && <div className="rounded-xl border border-neutral-800 bg-[#111] p-6 text-neutral-500">No {selected === 'All' ? '' : `${selected} `}team results have been recorded yet.</div>}
    {standings.length > 0 && <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#111]"><table className="min-w-[680px] text-sm"><thead><tr className="bg-[#191919] text-left text-xs uppercase tracking-wide text-neutral-500"><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Team</th><th className="px-4 py-3">Format</th><th className="px-4 py-3">Series Record</th><th className="px-4 py-3">Series Win %</th><th className="px-4 py-3">Game Record</th></tr></thead><tbody>{standings.map((team,index) => <tr key={team.id} className="border-t border-neutral-800"><td className="px-4 py-4 font-mono text-neutral-500">#{index+1}</td><td className="px-4 py-4"><Link href={`/teams/${encodeURIComponent(team.name)}`} className="font-bold text-white hover:underline">{team.name}</Link></td><td className="px-4 py-4"><span className="rounded-full border border-neutral-700 px-2 py-1 text-xs text-neutral-400">{team.format}</span></td><td className="px-4 py-4 font-semibold">{team.seriesWon}–{team.seriesLost}</td><td className="px-4 py-4">{(team.seriesPct*100).toFixed(1)}%</td><td className="px-4 py-4">{team.gamesWon}–{team.gamesLost}</td></tr>)}</tbody></table></div>}
  </main>
}
