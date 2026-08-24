/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from 'next'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { EmptyState, PageHero, ResultBadge, SectionHeader, StatCard } from '@/components/ui'
import { competitionIdentity, formatsMatch } from '@/lib/competitions'
import { formatPublicDate, getSeriesOutcome } from '@/lib/results'
import { competitionRanks } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const { data } = await supabase.from('competitions').select('*').eq('id', Number(id)).maybeSingle()
  if (!data) return { title: 'Competition — Flop Reset' }
  const identity = competitionIdentity(data)
  return { title: `${identity.displayName} ${identity.format} — Flop Reset` }
}

export default async function Competition({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const competitionId = Number(id)
  const [{ data: competition }, { data: rawSeries }, { data: rawUpcoming }, { data: rawStats }] = await Promise.all([
    supabase.from('competitions').select('*').eq('id', competitionId).maybeSingle(),
    supabase.from('series').select('series_id, opponent_name, series_date, flop_reset_team_id, teams ( name, format ), matches ( * )').eq('competition_id', competitionId).order('series_date', { ascending: false }),
    supabase.from('scheduled_matches').select('scheduled_id, opponent_name, match_date, match_time, teams ( name, format )').eq('competition_id', competitionId).eq('status', 'scheduled').order('match_date'),
    supabase.from('match_player_stats').select('goals, assists, saves, score, players ( name ), matches!inner ( competition_id, is_forfeit, teams ( name, format ) )').eq('matches.competition_id', competitionId),
  ])

  if (!competition) return <main className="mx-auto max-w-5xl px-4 py-16"><EmptyState title="Competition not found" description="This competition is not available in the public archive." actionHref="/competitions" actionLabel="Back to competitions" /></main>

  const identity = competitionIdentity(competition)
  const series = (rawSeries ?? []).filter((row: any) => formatsMatch(competition.format, row.teams?.format))
  const mismatches = (rawSeries ?? []).filter((row: any) => !formatsMatch(competition.format, row.teams?.format))
  const upcoming = (rawUpcoming ?? []).filter((row: any) => formatsMatch(competition.format, row.teams?.format))
  const stats = (rawStats ?? []).filter((row: any) => formatsMatch(competition.format, row.matches?.teams?.format) && !row.matches?.is_forfeit)

  let seriesWins = 0
  let seriesLosses = 0
  let gameWins = 0
  let gameLosses = 0
  series.forEach((row: any) => { const outcome = getSeriesOutcome(row.matches ?? []); gameWins += outcome.wins; gameLosses += outcome.losses; if (outcome.won) seriesWins += 1; else if (outcome.lost) seriesLosses += 1 })

  const teams = [...new Set(series.map((row: any) => row.teams?.name).filter(Boolean))]
  const players = new Map<string, any>()
  stats.forEach((row: any) => {
    const name = row.players?.name
    if (!name) return
    const current = players.get(name) ?? { name, team: row.matches?.teams?.name ?? 'Unknown', games: 0, goals: 0, assists: 0, saves: 0, score: 0 }
    current.games += 1; current.goals += Number(row.goals ?? 0); current.assists += Number(row.assists ?? 0); current.saves += Number(row.saves ?? 0); current.score += Number(row.score ?? 0)
    players.set(name, current)
  })
  const leaders = competitionRanks([...players.values()].sort((a, b) => b.goals - a.goals), (player) => String(player.goals)).filter((entry) => entry.rank <= 5)

  return <main className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
    <PageHero eyebrow={`${identity.league} · ${identity.format}`} title={identity.displayName} description={`${identity.seasonLabel} · ${identity.format}. Results, schedule, squads, and leaders are isolated to this circuit and format.`}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard label="Series Record" value={`${seriesWins}–${seriesLosses}`} /><StatCard label="Game Record" value={`${gameWins}–${gameLosses}`} /><StatCard label="Flop Reset Squads" value={teams.length} /><StatCard label="Upcoming" value={upcoming.length} /></div>
    </PageHero>
    <nav className="sticky top-14 z-20 my-8 overflow-x-auto rounded-xl border border-neutral-800 bg-[#0d0d0d]/95 px-4 py-3"><div className="flex min-w-max gap-5 text-xs font-bold uppercase tracking-wide text-neutral-500">{[['overview', 'Overview'], ['schedule', 'Schedule'], ['results', 'Results'], ['leaders', 'Leaders'], ['teams', 'Teams']].map(([anchor, label]) => <a key={anchor} href={`#${anchor}`} className="hover:text-purple-300">{label}</a>)}</div></nav>

    <section id="overview" className="scroll-mt-28">
      <SectionHeader eyebrow="Circuit integrity" title="Overview" description={`This hub includes only ${competition.format} squads attached to competition ID ${competition.id}.`} />
      <div className="grid gap-4 md:grid-cols-3"><StatCard label="Circuit" value={identity.seasonLabel} /><StatCard label="Format" value={identity.format} /><StatCard label="Valid Series" value={series.length} /></div>
      {mismatches.length > 0 && <div className="mt-5 rounded-2xl border border-amber-800/60 bg-amber-950/20 p-5"><div className="font-bold text-amber-300">Data-integrity hold</div><p className="mt-2 text-sm text-amber-100/70">{mismatches.length} attached series use a different squad format and are withheld from every count, result, team list, and leaderboard on this hub. No production rows were changed.</p></div>}
    </section>

    <section id="schedule" className="mt-14 scroll-mt-28"><SectionHeader eyebrow="Next fixtures" title="Schedule" />{upcoming.length ? <div className="grid gap-3 md:grid-cols-2">{upcoming.map((match: any) => <article key={match.scheduled_id} className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><div className="text-xs text-neutral-600">{formatPublicDate(match.match_date)} {match.match_time || ''} · {match.teams?.format}</div><div className="mt-2 text-lg font-bold text-white">{match.teams?.name} <span className="text-neutral-600">vs</span> {match.opponent_name ?? 'Opponent TBD'}</div></article>)}</div> : <EmptyState title="No upcoming matches" description="No valid future fixture is currently scheduled for this circuit and format." />}</section>

    <section id="results" className="mt-14 scroll-mt-28"><SectionHeader eyebrow="Completed series" title="Results" description="Dates, squads, opponents, format, series record, and forfeit status use one consistent competition context." />{series.length ? <div className="space-y-3">{series.map((row: any) => { const outcome = getSeriesOutcome(row.matches ?? []); const isForfeit = outcome.forfeits > 0; return <Link key={row.series_id} href={`/matches/${row.series_id}`} className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-800 bg-[#111] p-4 text-white no-underline hover:border-purple-800 sm:flex-row sm:items-center"><div><div className="text-xs text-neutral-600">{formatPublicDate(row.series_date)} · {row.teams?.format}</div><div className="mt-1 font-bold">{row.teams?.name} vs {row.opponent_name}</div></div>{isForfeit ? <div className="text-right"><div className="font-black text-emerald-400">{outcome.won ? 'W' : 'L'} · FORFEIT</div><div className="text-xs font-bold text-amber-300">0–0 public score</div></div> : <ResultBadge wins={outcome.wins} losses={outcome.losses} />}</Link> })}</div> : <EmptyState title="No valid completed series" description="Attached rows with a different team format are withheld until the data audit is resolved." />}</section>

    <section id="leaders" className="mt-14 scroll-mt-28"><SectionHeader eyebrow="Player performance" title="Goals Leaders" description={`Non-forfeit ${competition.format} player statistics from this competition only, attributed through each match team.`} />{leaders.length ? <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#111]"><table className="min-w-[620px] text-sm"><thead><tr className="bg-[#191919] text-left text-xs uppercase text-neutral-500"><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Player</th><th className="px-4 py-3">Team</th><th className="px-4 py-3">GP</th><th className="px-4 py-3">Goals</th><th className="px-4 py-3">G/GP</th></tr></thead><tbody>{leaders.map(({ row: player, rank }) => <tr key={`${player.name}-${player.team}`} className="border-t border-neutral-800"><td className="px-4 py-3 text-neutral-600">#{rank}</td><td className="px-4 py-3"><Link href={`/players/${encodeURIComponent(player.name)}`} className="font-bold text-white hover:underline">{player.name}</Link></td><td className="px-4 py-3 text-neutral-500">{player.team}</td><td className="px-4 py-3">{player.games}</td><td className="px-4 py-3 font-bold text-purple-300">{player.goals}</td><td className="px-4 py-3">{(player.goals / player.games).toFixed(2)}</td></tr>)}</tbody></table></div> : <EmptyState title="No valid player leaders" description="No player statistics match both this competition ID and its team format." />}</section>

    <section id="teams" className="mt-14 scroll-mt-28"><SectionHeader eyebrow="Organization entries" title="Participating Squads" />{teams.length ? <div className="flex flex-wrap gap-3">{teams.map((team) => <Link key={team} href={`/teams/${encodeURIComponent(team)}`} className="rounded-full border border-neutral-700 bg-[#111] px-4 py-2 font-bold text-white no-underline hover:border-purple-700">{team} · {competition.format}</Link>)}</div> : <EmptyState title="No valid squads" description="No squad with the competition format is attached to a valid series." />}</section>
  </main>
}
