/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from 'next'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { EmptyState, PageHero, ResultBadge, SectionHeader, StatCard } from '@/components/ui'
import { competitionIdentity, formatsMatch, getCompetitionSummary } from '@/lib/competitions'
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
    supabase.from('series').select('series_id, opponent_name, series_date, notes, flop_reset_team_id, teams ( name, format ), matches ( * )').eq('competition_id', competitionId).order('series_date', { ascending: false }),
    supabase.from('scheduled_matches').select('scheduled_id, opponent_name, match_date, match_time, teams ( name, format )').eq('competition_id', competitionId).eq('status', 'scheduled').order('match_date'),
    supabase.from('match_player_stats').select('goals, assists, saves, score, players ( name ), matches!inner ( competition_id, is_forfeit, teams ( name, format ) )').eq('matches.competition_id', competitionId),
  ])

  if (!competition) return <main className="mx-auto max-w-5xl px-4 py-16"><EmptyState title="Competition not found" description="This competition is not available in the public archive." actionHref="/competitions" actionLabel="Back to competitions" /></main>

  const identity = competitionIdentity(competition)
  const summary = getCompetitionSummary({ competition, series: rawSeries ?? [], scheduledMatches: rawUpcoming ?? [] })
  const series = summary.officialSeries as any[]
  const upcoming = summary.upcomingMatches as any[]
  const stats = (rawStats ?? []).filter((row: any) => formatsMatch(competition.format, row.matches?.teams?.format) && !row.matches?.is_forfeit)

  const teams = summary.participatingFlopResetTeams
  const players = new Map<string, any>()
  stats.forEach((row: any) => {
    const name = row.players?.name
    if (!name) return
    const current = players.get(name) ?? { name, team: row.matches?.teams?.name ?? 'Unknown', games: 0, goals: 0, assists: 0, saves: 0, score: 0 }
    current.games += 1; current.goals += Number(row.goals ?? 0); current.assists += Number(row.assists ?? 0); current.saves += Number(row.saves ?? 0); current.score += Number(row.score ?? 0)
    players.set(name, current)
  })
  const leaders = competitionRanks([...players.values()].sort((a, b) => b.goals - a.goals), (player) => String(player.goals)).filter((entry) => entry.rank <= 5)

  return <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-10 md:px-8 md:py-14">
    <PageHero eyebrow={`${identity.league} · ${identity.format}`} title={identity.displayName} description={`${identity.seasonLabel} · ${identity.format}. Results, schedule, squads, and leaders are isolated to this circuit and format.`}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"><StatCard label="Status" value={identity.status === 'active' ? 'Playoffs' : identity.status} accent={identity.status === 'active'} /><StatCard label="Series Record" value={`${summary.seriesWins}–${summary.seriesLosses}`} /><StatCard label="Played Games" value={summary.playedGames} /><StatCard label="Game Record" value={`${summary.gameWins}–${summary.gameLosses}`} /><StatCard label="Flop Reset Squads" value={teams.length} /><StatCard label="Upcoming" value={upcoming.length} /></div>
      {identity.status === 'active' && <Link href={`/competitions/${competitionId}/playoffs`} className="mt-5 inline-flex rounded-xl bg-purple-700 px-5 py-3 text-sm font-black text-white no-underline hover:bg-purple-600">View Summer Circuit Playoffs →</Link>}
    </PageHero>
    <nav className="sticky top-14 z-20 my-8 max-w-full overflow-x-auto rounded-xl border border-neutral-800 bg-[#0d0d0d]/95 px-4 py-3"><div className="flex min-w-max gap-5 text-xs font-bold uppercase tracking-wide text-neutral-500"><a href="#overview" className="hover:text-purple-300">Overview</a><Link href={`/competitions/${competitionId}/teams`} className="text-purple-300 hover:text-white">Teams</Link><Link href={`/competitions/${competitionId}/playoffs`} className="hover:text-purple-300">Playoffs</Link><a href="#schedule" className="hover:text-purple-300">Schedule</a><a href="#results" className="hover:text-purple-300">Results</a><Link href={`/power-rankings?competition=${competitionId}&format=${encodeURIComponent(competition.format)}`} className="hover:text-purple-300">Power</Link><Link href={`/standings?competition=${competitionId}`} className="hover:text-purple-300">Standings</Link><a href="#leaders" className="hover:text-purple-300">Leaders</a></div></nav>

    <section id="overview" className="scroll-mt-28">
      <SectionHeader eyebrow="Summer Circuit" title="Overview" description={`${identity.seasonLabel} · ${competition.format} results, schedules, squads, leaders, and playoff history.`} />
      <div className="grid gap-4 md:grid-cols-3"><StatCard label="Circuit" value={identity.seasonLabel} /><StatCard label="Format" value={identity.format} /><StatCard label="Official Series" value={series.length} /></div>
      {summary.integrityProblems.length > 0 && <div className="mt-5 rounded-2xl border border-amber-800/60 bg-amber-950/20 p-5"><div className="font-bold text-amber-200">History temporarily incomplete</div><p className="mt-2 text-sm text-amber-100/70">Some recorded results are unavailable while the circuit archive is being corrected.</p></div>}
    </section>

    <section id="schedule" className="mt-14 scroll-mt-28"><SectionHeader eyebrow="Next fixtures" title="Schedule" />{upcoming.length ? <div className="grid gap-3 md:grid-cols-2">{upcoming.map((match: any) => <article key={match.scheduled_id} className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><div className="text-xs text-neutral-600">{formatPublicDate(match.match_date)} {match.match_time || ''} · {match.teams?.format}</div><div className="mt-2 text-lg font-bold text-white">{match.teams?.name} <span className="text-neutral-600">vs</span> {match.opponent_name ?? 'Opponent TBD'}</div></article>)}</div> : <EmptyState title="No upcoming matches" description="No valid future fixture is currently scheduled for this circuit and format." />}</section>

    <section id="results" className="mt-14 scroll-mt-28"><SectionHeader eyebrow="Completed series" title="Results" description="Dates, squads, opponents, format, series record, and forfeit status use one consistent competition context." />{series.length ? <div className="space-y-3">{series.map((row: any) => { const outcome = getSeriesOutcome(row.matches ?? [], row); const isForfeit = outcome.forfeits > 0; return <Link key={row.series_id} href={`/matches/${row.series_id}`} className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-800 bg-[#111] p-4 text-white no-underline hover:border-purple-800 sm:flex-row sm:items-center"><div><div className="text-xs text-neutral-600">{formatPublicDate(row.series_date)} · {row.teams?.format}</div><div className="mt-1 font-bold">{row.teams?.name} vs {row.opponent_name}</div></div>{isForfeit ? <div className="text-right"><div className="font-black text-emerald-400">{outcome.won ? 'W' : 'L'} · FORFEIT</div><div className="text-xs font-bold text-amber-300">0–0 public score</div></div> : <ResultBadge wins={outcome.wins} losses={outcome.losses} />}</Link> })}</div> : <EmptyState title="Match history is currently being rebuilt" description="Verified results will appear here as they are imported." />}</section>

    <section id="leaders" className="mt-14 scroll-mt-28"><SectionHeader eyebrow="Player performance" title="Competition Leaders" description={`Goals, assists, saves, and score from non-forfeit ${competition.format} games, attributed through the historical match squad.`} />{leaders.length ? <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#111]"><table className="min-w-[760px] text-sm"><thead><tr className="bg-[#191919] text-left text-xs uppercase text-neutral-500"><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Player</th><th className="px-4 py-3">Team</th><th className="px-4 py-3">GP</th><th className="px-4 py-3">Goals</th><th className="px-4 py-3">Assists</th><th className="px-4 py-3">Saves</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">G/GP</th></tr></thead><tbody>{leaders.map(({ row: player, rank }) => <tr key={`${player.name}-${player.team}`} className="border-t border-neutral-800"><td className="px-4 py-3 text-neutral-600">#{rank}</td><td className="px-4 py-3"><Link href={`/players/${encodeURIComponent(player.name)}`} className="font-bold text-white hover:underline">{player.name}</Link></td><td className="px-4 py-3 text-neutral-500">{player.team}</td><td className="px-4 py-3">{player.games}</td><td className="px-4 py-3 font-bold text-purple-300">{player.goals}</td><td className="px-4 py-3">{player.assists}</td><td className="px-4 py-3">{player.saves}</td><td className="px-4 py-3">{player.score}</td><td className="px-4 py-3">{(player.goals / player.games).toFixed(2)}</td></tr>)}</tbody></table></div> : <EmptyState title="No player leaders available" description="No non-forfeit player statistics are currently available for this circuit." />}</section>

    <section id="teams" className="mt-14 scroll-mt-28"><SectionHeader eyebrow="Competition field" title="Participating Teams" description="The league directory includes verified entries even before Flop Reset has played them." /><Link href={`/competitions/${competitionId}/teams`} className="inline-flex rounded-xl bg-purple-700 px-5 py-3 font-black text-white no-underline hover:bg-purple-600">Browse the full {competition.format} team directory →</Link>{teams.length ? <div className="mt-5 flex flex-wrap gap-3">{teams.map((team) => <Link key={team} href={`/teams/${encodeURIComponent(team)}`} className="rounded-full border border-purple-800 bg-[#111] px-4 py-2 font-bold text-white no-underline hover:border-purple-600">FR · {team}</Link>)}</div> : null}</section>
  </main>
}
