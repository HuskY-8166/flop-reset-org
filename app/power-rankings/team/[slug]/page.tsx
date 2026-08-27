/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { competitionIdentity } from '@/lib/competitions'
import { calculateEloWithHistory, RATING_MODEL_VERSION, type LeagueMatch } from '@/lib/elo'
import { PowerHistoryChart } from '@/components/PowerHistoryChart'

export const dynamic = 'force-dynamic'

function signed(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(1)}` }

export default async function TeamPowerProfile({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ competition?: string; format?: string; round?: string }>
}) {
  const [{ slug }, filters] = await Promise.all([params, searchParams])
  const teamName = decodeURIComponent(slug)
  const format = filters.format === '2v2' ? '2v2' : '3v3'
  const { data: competitions = [] } = await supabase.from('competitions').select('*').order('start_date', { ascending: false })
  const compatible = (competitions ?? []).filter((competition: any) => competition.format === format)
  const competition = compatible.find((item: any) => String(item.id) === filters.competition) ?? compatible.find((item: any) => item.status === 'active') ?? compatible[0] ?? null
  const scopeProbe = await supabase.from('league_matches').select('competition_id').limit(1)
  const competitionScoped = !scopeProbe.error
  let matchResult: { data: any[] | null }
  if (competitionScoped) {
    let query: any = supabase.from('league_matches').select('id, competition_id, format, round, tier, team_a, team_b, score_a, score_b, status, match_date, batch_label').eq('format', format)
    if (competition) query = query.eq('competition_id', competition.id)
    matchResult = await query
  } else {
    matchResult = await supabase.from('league_matches').select('id, format, round, tier, team_a, team_b, score_a, score_b, status, match_date, batch_label').eq('format', format) as any
  }
  const { data: rawMatches } = matchResult
  const matches = (rawMatches ?? []) as LeagueMatch[]
  const requestedRound = Number.parseInt(filters.round ?? '', 10)
  const scopedMatches = Number.isFinite(requestedRound) ? matches.filter((match) => (Number.parseInt(match.round.replace(/\D/g, ''), 10) || 0) <= requestedRound) : matches
  const engine = calculateEloWithHistory(scopedMatches)
  const summary = engine.teamSummaries.find((team) => team.team === teamName)
  if (!summary) notFound()
  const history = engine.matchHistory[teamName] ?? []
  const recent = history.slice(-5).reverse()
  const identity = competition ? competitionIdentity(competition) : null
  const backQuery = new URLSearchParams({ format, ...(competition ? { competition: String(competition.id) } : {}), ...(Number.isFinite(requestedRound) ? { round: String(requestedRound) } : {}) }).toString()

  return <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
    <Link href={`/power-rankings?${backQuery}`} className="text-sm font-semibold text-purple-300 hover:underline">← Back to Power Rankings</Link>
    <header className="mt-5 rounded-3xl border border-neutral-800 bg-gradient-to-br from-[#171717] to-[#0d0d0d] p-6 md:p-9"><div className="text-xs font-black uppercase tracking-[.22em] text-purple-400">Team Power Profile</div><h1 className="mt-2 text-4xl font-black md:text-6xl">{teamName}</h1><p className="mt-3 text-neutral-400">{identity ? `${identity.league} · ${identity.seasonLabel}` : 'Summer Circuit archive'} · {format} · model {RATING_MODEL_VERSION}</p>{!competitionScoped && <p className="mt-4 rounded-xl border border-amber-900/60 bg-amber-950/20 p-3 text-sm text-amber-200">This profile currently covers Summer Circuit results only. Future circuits will remain separate.</p>}</header>

    <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Current Rating" value={Math.round(summary.rating)} /><Stat label="Overall Rank" value={`#${summary.overallRank}`} /><Stat label="Tier Rank" value={`#${summary.tierRank} / ${summary.tier}`} /><Stat label="Sample" value={summary.confidence} /><Stat label="Peak / Low" value={`${Math.round(summary.peak)} / ${Math.round(summary.worst)}`} /><Stat label="Last Round" value={signed(summary.lastRoundDelta)} /><Stat label="Last 3 Rounds" value={signed(summary.threeRoundDelta)} /><Stat label="Last 5 Rounds" value={signed(summary.fiveRoundDelta)} /></section>

    <section className="mt-10 grid gap-4 md:grid-cols-3"><Panel title="Recent Form"><div className="flex gap-2">{summary.recentForm.map((result, index) => <span key={index} className={`grid h-9 w-9 place-items-center rounded-lg font-black ${result === 'W' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>{result}</span>)}</div></Panel><Panel title="Opponent-Adjusted Form"><div className="text-2xl font-black text-white">{summary.adjustedForm >= 0 ? '+' : ''}{summary.adjustedForm.toFixed(3)}</div><p className="mt-1 text-xs text-neutral-500">Average actual result minus Elo expectation; transparent, not a separate rating.</p></Panel><Panel title="Strength of Schedule"><div className="text-2xl font-black text-white">#{summary.sosRank} hardest in {summary.tier}</div><p className="mt-1 text-xs text-neutral-500">Full {summary.sosFull.toFixed(0)} · Recent five {summary.sosRecent5.toFixed(0)} average opponent pre-match Elo.</p></Panel></section>

    <PowerHistoryChart history={{ [teamName]: engine.teamRoundHistory[teamName] ?? [] }} teams={[teamName]} />

    <section className="mt-12"><div className="text-xs font-black uppercase tracking-[.22em] text-purple-400">Opponent intelligence</div><h2 className="mt-1 text-3xl font-black">Recent Opponents</h2><div className="mt-5 grid gap-3">{recent.map((event) => <article key={`${event.matchKey}-${event.team}`} className="grid gap-3 rounded-2xl border border-neutral-800 bg-[#111] p-4 sm:grid-cols-[1fr_auto_auto]"><div><div className="font-black text-white">{event.opponent}</div><div className="text-xs text-neutral-500">{event.roundLabel} · {event.date}</div></div><div><div className={`font-black ${event.result === 'W' ? 'text-emerald-400' : 'text-red-400'}`}>{event.result} {event.displayScore}</div><div className="text-xs text-neutral-500">{signed(event.delta)} rating</div></div><div className="sm:text-right"><div className="font-mono text-white">{Math.round(event.opponentRatingBefore)}</div><div className="text-xs text-neutral-500">opponent before match</div></div></article>)}</div></section>

    <section className="mt-12 grid gap-4 md:grid-cols-2"><MatchAward label="Best Win" event={summary.bestWin} /><MatchAward label="Worst Loss" event={summary.worstLoss} /></section>
    {summary.matchesTracked < 4 && <div className="mt-8 rounded-2xl border border-amber-900/60 bg-amber-950/20 p-5"><div className="font-black text-amber-300">LOW SAMPLE</div><p className="mt-1 text-sm text-neutral-400">This team has only {summary.matchesTracked} tracked result{summary.matchesTracked === 1 ? '' : 's'}. Treat its current rating and schedule context as provisional.</p></div>}
  </main>
}

function Stat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl border border-neutral-800 bg-[#111] p-4"><div className="text-xs uppercase text-neutral-500">{label}</div><div className="mt-1 text-2xl font-black text-white">{value}</div></div> }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><h2 className="mb-3 font-black text-white">{title}</h2>{children}</div> }
function MatchAward({ label, event }: { label: string; event: ReturnType<typeof calculateEloWithHistory>['teamSummaries'][number]['bestWin'] }) { return <div className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><div className="text-xs font-black uppercase tracking-[.2em] text-purple-400">{label}</div>{event ? <><div className="mt-2 text-xl font-black text-white">vs {event.opponent}</div><div className="mt-1 text-sm text-neutral-400">{event.result} {event.displayScore} · {event.roundLabel}</div><div className="mt-4 grid grid-cols-3 gap-3 text-sm"><Stat label="Opponent" value={Math.round(event.opponentRatingBefore)} /><Stat label="Expectation" value={`${(event.expectedWinProbability * 100).toFixed(0)}%`} /><Stat label="Change" value={signed(event.delta)} /></div></> : <p className="mt-3 text-sm text-neutral-500">No qualifying non-forfeit result.</p>}</div> }
