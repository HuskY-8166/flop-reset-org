/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EmptyState, EntityBadge, FormIndicator, PageHero, ResultBadge, SectionHeader, StatCard } from '@/components/ui'
import { formatPublicDate, getGameOutcome, getSeriesOutcome } from '@/lib/results'
import { normalizeIdentity } from '@/lib/stats'
import { supabase } from '@/lib/supabase'
import { competitionIdentity } from '@/lib/competitions'

export const dynamic = 'force-dynamic'
type PageProps = { params: Promise<{ opponent: string }> }

function displayOpponent(value: string) {
  try { return decodeURIComponent(value) } catch { return value }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { opponent } = await params
  const name = displayOpponent(opponent)
  return { title: `${name} Rivalry`, description: `Flop Reset's complete recorded history against ${name}.` }
}

export default async function RivalryDetail({ params }: PageProps) {
  const { opponent } = await params
  const requestedName = displayOpponent(opponent)
  const requestedKey = normalizeIdentity(requestedName)
  const { data: allSeries } = await supabase
    .from('series')
    .select('series_id, opponent_name, series_date, best_of, teams ( name, format ), competitions ( * ), matches ( * )')
    .order('series_date', { ascending: false })
  const series = (allSeries ?? []).filter((meeting: any) => normalizeIdentity(meeting.opponent_name) === requestedKey) as any[]
  if (!series.length) notFound()

  const name = series[0].opponent_name ?? requestedName
  let seriesWins = 0
  let seriesLosses = 0
  let gameWins = 0
  let gameLosses = 0
  let goalsFor = 0
  let goalsAgainst = 0
  let biggestMargin = Number.NEGATIVE_INFINITY
  let biggestWin: any = null
  const competitionMap = new Map<string, { wins: number; losses: number; series: number }>()
  const formatMap = new Map<string, { wins: number; losses: number; series: number }>()
  const form: Array<{ id: number; won: boolean; href: string }> = []

  for (const meeting of series) {
    const outcome = getSeriesOutcome(meeting.matches ?? [])
    if (outcome.won) seriesWins += 1
    else if (outcome.lost) seriesLosses += 1
    gameWins += outcome.wins
    gameLosses += outcome.losses
    form.push({ id: meeting.series_id, won: outcome.won, href: `/matches/${meeting.series_id}` })

    const context = meeting.competitions ? competitionIdentity(meeting.competitions) : null
    const competition = context ? `${context.displayName} ${context.year} · ${meeting.teams?.format ?? context.format}` : 'Competition not recorded'
    const competitionRow = competitionMap.get(competition) ?? { wins: 0, losses: 0, series: 0 }
    competitionRow.series += 1
    if (outcome.won) competitionRow.wins += 1
    else if (outcome.lost) competitionRow.losses += 1
    competitionMap.set(competition, competitionRow)

    const format = meeting.teams?.format ?? 'Format not recorded'
    const formatRow = formatMap.get(format) ?? { wins: 0, losses: 0, series: 0 }
    formatRow.series += 1
    if (outcome.won) formatRow.wins += 1
    else if (outcome.lost) formatRow.losses += 1
    formatMap.set(format, formatRow)

    for (const game of meeting.matches ?? []) {
      const gameOutcome = getGameOutcome(game)
      const performance = gameOutcome.performanceScore
      if (!performance) continue
      goalsFor += performance.for
      goalsAgainst += performance.against
      const margin = performance.for - performance.against
      if (gameOutcome.won && margin > biggestMargin) {
        biggestMargin = margin
        biggestWin = { ...game, series_id: meeting.series_id, date: meeting.series_date }
      }
    }
  }

  const firstMeeting = series.at(-1)
  const latestMeeting = series[0]
  let currentStreak = 0
  const currentResult = form[0]?.won
  for (const result of form) {
    if (result.won !== currentResult) break
    currentStreak += 1
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-white">
      <PageHero eyebrow="Rivalry archive" title={`Flop Reset vs ${name}`} description={`${series.length} recorded series across every represented roster and competition.`}>
        <div className="flex flex-wrap gap-2"><EntityBadge>{seriesWins}–{seriesLosses} series</EntityBadge><EntityBadge>{gameWins}–{gameLosses} games</EntityBadge><EntityBadge>First meeting {formatPublicDate(firstMeeting?.series_date)}</EntityBadge></div>
      </PageHero>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Series Record" value={`${seriesWins}–${seriesLosses}`} detail={`${seriesWins + seriesLosses ? ((seriesWins / (seriesWins + seriesLosses)) * 100).toFixed(1) : '0.0'}% win rate`} />
        <StatCard label="Game Record" value={`${gameWins}–${gameLosses}`} detail={`${gameWins + gameLosses} decisive games`} />
        <StatCard label="Performance Goal Difference" value={`${goalsFor - goalsAgainst > 0 ? '+' : ''}${goalsFor - goalsAgainst}`} detail={`${goalsFor} for · ${goalsAgainst} against · forfeits excluded`} />
        <StatCard label="Current Streak" value={form.length ? `${currentResult ? 'W' : 'L'}${currentStreak}` : '—'} detail="Calculated across the full rivalry" />
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div><SectionHeader eyebrow="Across events" title="Competition Breakdown" /><div className="space-y-3">{[...competitionMap.entries()].map(([competition, row]) => <div key={competition} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-[#111] p-4"><div><div className="font-bold">{competition}</div><div className="text-xs text-neutral-600">{row.series} series</div></div><ResultBadge wins={row.wins} losses={row.losses} /></div>)}</div></div>
        <div><SectionHeader eyebrow="Distinct environments" title="Format Breakdown" /><div className="space-y-3">{[...formatMap.entries()].map(([format, row]) => <div key={format} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-[#111] p-4"><div><div className="font-bold">{format}</div><div className="text-xs text-neutral-600">{row.series} series</div></div><ResultBadge wins={row.wins} losses={row.losses} /></div>)}</div></div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <div><SectionHeader eyebrow="Complete ledger" title="Series History" description="Every stored head-to-head series, newest first." /><div className="space-y-3">{series.map((meeting) => {const outcome=getSeriesOutcome(meeting.matches??[]);const context=meeting.competitions?competitionIdentity(meeting.competitions):null;const contextLabel=context?`${context.displayName} ${context.year} · ${meeting.teams?.format??context.format}`:'Recorded competition';return <Link key={meeting.series_id} href={`/matches/${meeting.series_id}`} className="grid gap-3 rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline transition hover:border-purple-800 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[.16em] text-neutral-500"><span>{formatPublicDate(meeting.series_date)}</span><span>·</span><span>{contextLabel}</span></div><div className="mt-2 text-lg font-black">{meeting.teams?.name ?? 'Flop Reset'} <span className="font-medium text-neutral-500">({meeting.teams?.format ?? '—'})</span></div><div className="mt-2"><FormIndicator results={(meeting.matches??[]).map((game:any,index:number)=>({id:game.match_id??index,won:getGameOutcome(game).won}))}/></div></div><ResultBadge wins={outcome.wins} losses={outcome.losses}/></Link>})}</div></div>
        <aside><SectionHeader eyebrow="Rivalry notes" title="At a Glance" /><div className="space-y-3"><div className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><div className="text-xs font-bold uppercase tracking-[.18em] text-purple-300">Latest Meeting</div><div className="mt-2 text-xl font-black">{formatPublicDate(latestMeeting?.series_date)}</div><Link href={`/matches/${latestMeeting?.series_id}`} className="mt-3 inline-block text-sm text-neutral-400 hover:text-white">Open Match Center →</Link></div>{biggestWin ? <div className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><div className="text-xs font-bold uppercase tracking-[.18em] text-purple-300">Biggest Performance Win</div><div className="mt-2 text-3xl font-black">{getGameOutcome(biggestWin).displayScore}</div><div className="mt-1 text-sm text-neutral-500">{formatPublicDate(biggestWin.date)} · forfeits excluded</div></div> : <EmptyState title="No performance win stored" description="Forfeits are excluded from biggest-win calculations." />}</div></aside>
      </section>
    </main>
  )
}
