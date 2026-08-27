/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { EmptyState, PageHero, ResultBadge, SectionHeader } from '@/components/ui'
import { competitionIdentity, getCompetitionSummary } from '@/lib/competitions'

export const dynamic = 'force-dynamic'

export default async function Competitions() {
  const [{ data: competitions }, { data: series }, { data: scheduled }] = await Promise.all([
    supabase.from('competitions').select('*').order('id'),
    supabase.from('series').select('competition_id, series_id, teams ( name, format ), matches ( * )'),
    supabase.from('scheduled_matches').select('competition_id, scheduled_id, teams ( name, format )').eq('status', 'scheduled'),
  ])

  const groups = new Map<string, { identity: ReturnType<typeof competitionIdentity>; competitions: any[] }>()
  for (const competition of competitions ?? []) {
    const identity = competitionIdentity(competition)
    const group = groups.get(identity.groupKey) ?? { identity, competitions: [] }
    group.competitions.push(competition)
    groups.set(identity.groupKey, group)
  }

  return <main className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
    <PageHero eyebrow="League & circuit archive" title="Competitions" description="Circuits remain historically separate, with independent 3v3 and 2v2 records inside each season." />
    <section className="mt-12">
      <SectionHeader eyebrow="Competition library" title="Recorded Circuits" description="Results, schedules, squads, and records stay separated by circuit and format." />
      {groups.size ? <div className="space-y-8">{[...groups.values()].map(({ identity, competitions: groupCompetitions }) => <section key={identity.groupKey} className="rounded-3xl border border-neutral-800 bg-[#0f0f0f] p-5 md:p-7">
        <div className="text-xs font-black uppercase tracking-[.24em] text-purple-400">{identity.league}</div>
        <h2 className="mt-2 text-3xl font-black text-white">{identity.seasonLabel}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">{groupCompetitions.sort((a, b) => String(a.format).localeCompare(String(b.format))).map((competition) => {
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
