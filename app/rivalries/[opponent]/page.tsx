/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { EmptyState, EntityBadge, FormIndicator, PageHero, ResultBadge, SectionHeader, StatCard } from '@/components/ui'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ opponent: string }> }

function displayOpponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { opponent } = await params
  const name = displayOpponent(opponent)
  return { title: `${name} Rivalry | Flop Reset`, description: `Flop Reset's complete recorded history against ${name}.` }
}

export default async function RivalryDetail({ params }: PageProps) {
  const { opponent } = await params
  const name = displayOpponent(opponent)
  const { data: series } = await supabase
    .from('series')
    .select('series_id, opponent_name, series_date, best_of, teams ( name, format ), competitions ( name ), matches ( match_id, flop_reset_score, opponent_score, is_forfeit )')
    .ilike('opponent_name', name)
    .order('series_date', { ascending: false })

  if (!series?.length) notFound()

  let seriesWins = 0
  let seriesLosses = 0
  let gameWins = 0
  let gameLosses = 0
  let goalsFor = 0
  let goalsAgainst = 0
  let biggestMargin = Number.NEGATIVE_INFINITY
  let biggestWin: any = null

  const form = series.slice(0, 8).map((meeting: any) => {
    const games = meeting.matches ?? []
    const wins = games.filter((game: any) => game.flop_reset_score > game.opponent_score).length
    const losses = games.filter((game: any) => game.flop_reset_score < game.opponent_score).length
    return wins > losses ? 'W' : 'L'
  }) as Array<'W' | 'L'>

  for (const meeting of series as any[]) {
    const meetingGames = meeting.matches ?? []
    const meetingWins = meetingGames.filter((game: any) => game.flop_reset_score > game.opponent_score).length
    const meetingLosses = meetingGames.filter((game: any) => game.flop_reset_score < game.opponent_score).length
    if (meetingWins > meetingLosses) seriesWins += 1
    else if (meetingLosses > meetingWins) seriesLosses += 1
    for (const game of meeting.matches ?? []) {
      if (game.flop_reset_score > game.opponent_score) gameWins += 1
      else if (game.flop_reset_score < game.opponent_score) gameLosses += 1
      goalsFor += game.flop_reset_score ?? 0
      goalsAgainst += game.opponent_score ?? 0
      const margin = (game.flop_reset_score ?? 0) - (game.opponent_score ?? 0)
      if (margin > biggestMargin) {
        biggestMargin = margin
        biggestWin = { ...game, series_id: meeting.series_id, date: meeting.series_date }
      }
    }
  }

  const firstMeeting = series.at(-1) as any
  const latestMeeting = series[0] as any
  const currentStreak = form.length
    ? form.findIndex((result) => result !== form[0]) === -1
      ? form.length
      : form.findIndex((result) => result !== form[0])
    : 0

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-white">
      <PageHero eyebrow="Rivalry Archive" title={`Flop Reset vs ${name}`} description={`${series.length} recorded series across every represented roster and competition.`}>
        <div className="flex flex-wrap gap-2">
          <EntityBadge>{seriesWins}–{seriesLosses} series</EntityBadge>
          <EntityBadge>{gameWins}–{gameLosses} games</EntityBadge>
          <EntityBadge>First meeting {firstMeeting?.series_date ?? '—'}</EntityBadge>
        </div>
      </PageHero>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Series Record" value={`${seriesWins}–${seriesLosses}`} detail={`${seriesWins + seriesLosses ? ((seriesWins / (seriesWins + seriesLosses)) * 100).toFixed(1) : '0.0'}% win rate`} />
        <StatCard label="Game Record" value={`${gameWins}–${gameLosses}`} detail={`${gameWins + gameLosses} decisive games`} />
        <StatCard label="Goal Difference" value={`${goalsFor - goalsAgainst > 0 ? '+' : ''}${goalsFor - goalsAgainst}`} detail={`${goalsFor} for · ${goalsAgainst} against`} />
        <StatCard label="Current Streak" value={form.length ? `${form[0]}${currentStreak}` : '—'} detail="Most recent series first" />
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <SectionHeader eyebrow="Complete ledger" title="Series History" description="Every stored head-to-head series, newest first." />
          <div className="space-y-3">
            {(series as any[]).map((meeting) => {
              const games = meeting.matches ?? []
              const wins = games.filter((game: any) => game.flop_reset_score > game.opponent_score).length
              const losses = games.filter((game: any) => game.flop_reset_score < game.opponent_score).length
              const team = Array.isArray(meeting.teams) ? meeting.teams[0] : meeting.teams
              const competition = Array.isArray(meeting.competitions) ? meeting.competitions[0] : meeting.competitions
              return (
                <Link key={meeting.series_id} href={`/matches/${meeting.series_id}`} className="grid gap-3 rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline transition hover:border-purple-800 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[.16em] text-neutral-500">
                      <span>{meeting.series_date}</span><span>·</span><span>{competition?.name ?? 'Recorded competition'}</span>
                    </div>
                    <div className="mt-2 text-lg font-black">{team?.name ?? 'Flop Reset'} <span className="font-medium text-neutral-500">({team?.format ?? '—'})</span></div>
                    <div className="mt-2"><FormIndicator results={games.map((game: any, index: number) => ({ id: game.match_id ?? index, won: game.flop_reset_score > game.opponent_score }))} /></div>
                  </div>
                  <ResultBadge wins={wins} losses={losses} />
                </Link>
              )
            })}
          </div>
        </div>

        <aside>
          <SectionHeader eyebrow="Rivalry notes" title="At a Glance" />
          <div className="space-y-3">
            <div className="rounded-2xl border border-neutral-800 bg-[#111] p-5">
              <div className="text-xs font-bold uppercase tracking-[.18em] text-purple-300">Latest Meeting</div>
              <div className="mt-2 text-xl font-black">{latestMeeting?.series_date}</div>
              <Link href={`/matches/${latestMeeting?.series_id}`} className="mt-3 inline-block text-sm text-neutral-400 hover:text-white">Open Match Center →</Link>
            </div>
            {biggestWin && biggestMargin > 0 ? <div className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><div className="text-xs font-bold uppercase tracking-[.18em] text-purple-300">Biggest Game Win</div><div className="mt-2 text-3xl font-black">{biggestWin.flop_reset_score}–{biggestWin.opponent_score}</div><div className="mt-1 text-sm text-neutral-500">{biggestWin.date}</div></div> : <EmptyState title="No game win stored" description="The archive does not yet contain a winning game in this matchup." />}
          </div>
        </aside>
      </section>
    </main>
  )
}
