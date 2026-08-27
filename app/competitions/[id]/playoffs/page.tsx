/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from 'next'
import Link from 'next/link'
import { PlayoffBracket } from '@/components/PlayoffBracket'
import { EmptyState, PageHero } from '@/components/ui'
import { competitionIdentity } from '@/lib/competitions'
import { normalizePlayoffData } from '@/lib/playoffs'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const { data } = await supabase.from('competitions').select('*').eq('id', Number(id)).maybeSingle()
  if (!data) return { title: 'Playoffs — Flop Reset' }
  const identity = competitionIdentity(data)
  return { title: `${identity.league} ${identity.seasonLabel} Playoffs — Flop Reset` }
}

export default async function CompetitionPlayoffs({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const competitionId = Number(id)
  const [{ data: competition }, { data: brackets, error: bracketError }] = await Promise.all([
    supabase.from('competitions').select('*').eq('id', competitionId).maybeSingle(),
    supabase.from('playoff_brackets').select('*').eq('competition_id', competitionId).order('tier'),
  ])

  if (!competition) return <main className="mx-auto max-w-6xl px-4 py-16"><EmptyState title="Competition not found" description="This playoff archive is not available." actionHref="/competitions" actionLabel="Back to competitions" /></main>

  const bracketIds = (brackets ?? []).map((bracket: any) => bracket.bracket_id)
  const { data: rawMatches, error: matchError } = bracketIds.length
    ? await supabase.from('playoff_matches').select('*').in('bracket_id', bracketIds).order('match_order')
    : { data: [], error: null }
  const seriesIds = [...new Set((rawMatches ?? []).map((match: any) => Number(match.series_id)).filter(Boolean))]
  const scheduleIds = [...new Set((rawMatches ?? []).map((match: any) => Number(match.scheduled_match_id)).filter(Boolean))]
  const [{ data: series }, { data: schedule }] = await Promise.all([
    seriesIds.length ? supabase.from('series').select('series_id, opponent_name, notes, teams ( name, format ), matches ( * )').in('series_id', seriesIds) : Promise.resolve({ data: [] }),
    scheduleIds.length ? supabase.from('scheduled_matches').select('scheduled_id, opponent_name, starts_at, match_date, teams ( name, format )').in('scheduled_id', scheduleIds) : Promise.resolve({ data: [] }),
  ])
  const linkedSeries = new Map((series ?? []).map((row: any) => [Number(row.series_id), row]))
  const linkedSchedule = new Map((schedule ?? []).map((row: any) => [Number(row.scheduled_id), row]))
  const publicBrackets = normalizePlayoffData(brackets ?? [], rawMatches ?? [], linkedSeries, linkedSchedule)
  const identity = competitionIdentity(competition)

  return <main className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
    <Link href={`/competitions/${competitionId}`} className="mb-6 inline-block text-sm font-semibold text-purple-300 hover:underline">← Back to competition overview</Link>
    <PageHero eyebrow={`${identity.league} · ${identity.format}`} title={`${identity.seasonLabel} Playoffs`} description={`${identity.league} ${identity.seasonLabel} · ${identity.format}. Brackets are rendered from verified playoff rows and preserved with this competition forever.`} accent="#8F00FF" />
    {(bracketError || matchError) && <div className="mt-6 rounded-2xl border border-red-900 bg-red-950/20 p-5 text-sm text-red-200">Playoff data could not be loaded: {(bracketError ?? matchError)?.message}</div>}
    <PlayoffBracket brackets={publicBrackets} />
  </main>
}
