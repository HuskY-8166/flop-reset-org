/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { EmptyState, PageHero, SectionHeader } from '@/components/ui'
import { competitionIdentity, formatsMatch } from '@/lib/competitions'
import { getSeriesOutcome } from '@/lib/results'
import { competitionRanks } from '@/lib/stats'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function Standings({ searchParams }: { searchParams: Promise<{ competition?: string }> }) {
  const query = await searchParams
  const [{ data: competitions }, { data: teams, error }, { data: series }] = await Promise.all([
    supabase.from('competitions').select('*').order('id'),
    supabase.from('teams').select('id, name, format').order('name'),
    supabase.from('series').select('competition_id, flop_reset_team_id, teams ( name, format ), matches ( * )'),
  ])

  const requestedId = Number(query.competition)
  const selectedCompetition = (competitions ?? []).find((row) => Number(row.id) === requestedId) ?? (competitions ?? []).at(-1)
  const identity = selectedCompetition ? competitionIdentity(selectedCompetition) : null
  const attached = selectedCompetition ? (series ?? []).filter((row: any) => Number(row.competition_id) === Number(selectedCompetition.id)) : []
  const validSeries = selectedCompetition ? attached.filter((row: any) => formatsMatch(selectedCompetition.format, row.teams?.format)) : []
  const withheld = attached.length - validSeries.length

  const rows = selectedCompetition ? (teams ?? [])
    .filter((team) => team.format === selectedCompetition.format)
    .map((team) => {
      let seriesWon = 0; let seriesLost = 0; let gamesWon = 0; let gamesLost = 0
      for (const entry of validSeries.filter((row: any) => Number(row.flop_reset_team_id) === Number(team.id))) {
        const outcome = getSeriesOutcome((entry as any).matches ?? [])
        gamesWon += outcome.wins; gamesLost += outcome.losses
        if (outcome.won) seriesWon += 1; else if (outcome.lost) seriesLost += 1
      }
      const seriesPct = seriesWon + seriesLost ? seriesWon / (seriesWon + seriesLost) : 0
      return { ...team, seriesWon, seriesLost, gamesWon, gamesLost, seriesPct }
    })
    .filter((team) => team.seriesWon + team.seriesLost > 0)
    .sort((a, b) => b.seriesPct - a.seriesPct || b.seriesWon - a.seriesWon || b.gamesWon - a.gamesWon || a.gamesLost - b.gamesLost) : []

  const ranked = competitionRanks(rows, (team) => [team.seriesPct, team.seriesWon, team.gamesWon, team.gamesLost].join('|'))

  return <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
    <PageHero eyebrow="Circuit-scoped team performance" title="Standings" description={identity ? `${identity.displayName} ${identity.year} · ${identity.format}. Each circuit starts with a fresh table.` : 'Standings become available after a competition is created.'} />
    <nav className="my-8 flex flex-wrap gap-2" aria-label="Standings competition">{(competitions ?? []).map((competition) => { const item = competitionIdentity(competition); const active = Number(competition.id) === Number(selectedCompetition?.id); return <Link key={competition.id} href={`/standings?competition=${competition.id}`} aria-current={active ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-bold no-underline ${active ? 'bg-purple-700 text-white' : 'border border-neutral-800 bg-[#151515] text-neutral-400'}`}>{item.seasonLabel} · {item.format}</Link> })}</nav>
    {error && <div className="rounded-xl border border-red-900 bg-red-950/20 p-4 text-red-300">Standings could not be loaded: {error.message}</div>}
    {withheld > 0 && <div className="mb-8 rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-300">{withheld} mismatched series are withheld from this table pending the competition audit.</div>}
    {!error && !ranked.length ? <EmptyState title="No valid standings available" description="No completed series currently match both this competition and its squad format." /> : null}
    {ranked.length ? <section><SectionHeader eyebrow="Competition table" title={`${identity?.format} Standings`} description="Competition ranking is used for exact ties: 1, 2, 2, 4." /><div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#111]"><table className="min-w-[680px] text-sm"><thead><tr className="bg-[#191919] text-left text-xs uppercase tracking-wide text-neutral-500"><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Team</th><th className="px-4 py-3">Series Record</th><th className="px-4 py-3">Series Win %</th><th className="px-4 py-3">Game Record</th></tr></thead><tbody>{ranked.map(({ row: team, rank }) => <tr key={team.id} className="border-t border-neutral-800"><td className="px-4 py-4 font-mono text-neutral-500">#{rank}</td><td className="px-4 py-4"><Link href={`/teams/${encodeURIComponent(team.name)}`} className="font-bold text-white hover:underline">{team.name}</Link></td><td className="px-4 py-4 font-semibold">{team.seriesWon}–{team.seriesLost}</td><td className="px-4 py-4">{(team.seriesPct * 100).toFixed(1)}%</td><td className="px-4 py-4">{team.gamesWon}–{team.gamesLost}</td></tr>)}</tbody></table></div></section> : null}
  </main>
}
