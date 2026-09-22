/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { EmptyState, PageHero, ResultBadge, SectionHeader } from '@/components/ui'
import { getCompetitionSummary } from '@/lib/competitions'
import { groupCompetitionsBySeason } from '@/lib/seasons'

export const dynamic = 'force-dynamic'

export default async function Competitions() {
  const [{ data: competitions }, { data: series }, { data: scheduled }, { data: seasons }] = await Promise.all([
    supabase.from('competitions').select('*').order('id'),
    supabase.from('series').select('competition_id, series_id, opponent_name, notes, is_forfeit, result_override, teams ( name, format ), matches ( * )'),
    supabase.from('scheduled_matches').select('competition_id, scheduled_id, teams ( name, format )').eq('status', 'scheduled'),
    supabase.from('public_competition_seasons').select('*').order('season_year', { ascending: false }),
  ])
  const groups = groupCompetitionsBySeason(competitions ?? [], seasons ?? [])

  return <main className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
    <PageHero eyebrow="League & circuit archive" title="Competitions" description="Circuits remain historically separate, with independent 3v3 and 2v2 records inside each season." />
    <section className="mt-12">
      <SectionHeader eyebrow="Competition library" title="Recorded Circuits" description="Results, schedules, squads, and records stay separated by circuit and format." />
      {groups.length ? <div className="space-y-8">{groups.map((group) => <section key={group.key} className="rounded-3xl border border-neutral-800 bg-[#0f0f0f] p-5 md:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="text-xs font-black uppercase tracking-[.24em] text-purple-400">{group.league}</div><h2 className="mt-2 text-3xl font-black text-white">{group.name} {group.year}</h2><span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${group.status === 'completed' || group.status === 'archived' ? 'border-emerald-800 text-emerald-300' : 'border-neutral-700 text-neutral-400'}`}>{group.status.toUpperCase()}</span></div><Link href={`/competitions/archive/${group.slug}`} className="rounded-xl border border-purple-700 px-4 py-2 text-sm font-black text-purple-200 no-underline hover:bg-purple-950">Open season archive →</Link></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">{group.competitions.map((competition) => {
          const attached = (series ?? []).filter((row: any) => Number(row.competition_id) === Number(competition.id))
          const summary = getCompetitionSummary({
            competition,
            series: attached,
            scheduledMatches: (scheduled ?? []).filter((row: any) => Number(row.competition_id) === Number(competition.id)),
          })
          return <Link key={competition.id} href={`/competitions/${competition.id}`} className="group rounded-2xl border border-neutral-800 bg-[#151515] p-5 text-white no-underline hover:-translate-y-0.5 hover:border-purple-700">
            <div className="flex items-start justify-between gap-4"><div><div className="text-2xl font-black text-purple-300">{competition.format}</div><div className="mt-1 text-sm text-neutral-500">{summary.officialSeries.length} completed series · {summary.upcomingMatches.length} upcoming</div></div>{summary.officialSeries.length ? <ResultBadge wins={summary.seriesWins} losses={summary.seriesLosses} /> : <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-bold text-neutral-500">No results yet</span>}</div>
            {summary.integrityProblems.length > 0 && <div className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">Some historical results are temporarily unavailable.</div>}
            <div className="mt-4 text-sm text-purple-300">Open {competition.format} hub →</div>
          </Link>
        })}</div>
      </section>)}</div> : <EmptyState title="No competitions recorded" description="Competition hubs will appear when the first event is ready." />}
    </section>
  </main>
}
