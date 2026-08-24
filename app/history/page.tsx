/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { EmptyState, PageHero, ResultBadge, SectionHeader, StatCard } from '@/components/ui'
import { formatPublicDate, getSeriesOutcome } from '@/lib/results'
export const dynamic = 'force-dynamic'

export default async function History() {
  const [{ data: series }, { data: players }, { data: teams }] = await Promise.all([
    supabase.from('series').select('series_id, opponent_name, series_date, teams ( name, format ), matches ( * )').order('series_date',{ascending:false}),
    supabase.from('players').select('name, aliases, teams ( name, format )'),
    supabase.from('teams').select('id, name, format'),
  ])
  const sorted = [...(series ?? [])].sort((a:any,b:any) => (a.series_date??'').localeCompare(b.series_date??''))
  const archiveBegins = sorted[0]?.series_date ?? ''
  const totalGames = (series ?? []).reduce((sum:number,s:any)=>sum+(s.matches?.length??0),0)
  const aliasCount = new Set((players ?? []).flatMap((p:any)=>p.aliases??[])).size
  const firstWins = new Map<string,any>()
  for (const s of sorted as any[]) { const outcome=getSeriesOutcome(s.matches??[]); if(outcome.won && !firstWins.has(s.teams?.name)) firstWins.set(s.teams?.name,s) }
  const nav = [
    ['Record Book','/records','Current records and their progression'],['Rivalries','/rivalries','Every repeated opponent'],['All-Time Leaders','/history/leaders','Career totals across the archive'],['Transactions','/transactions','Roster-history foundation'],['Teams','/teams','Current squad identities'],['Match Archive','/matches','Every recorded series and game'],
  ]
  return <main className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
    <PageHero eyebrow="Permanent organization archive" title="Flop Reset History" description="The connected story of the teams, players, opponents, records, and results that built Flop Reset.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard label="Archive Begins" value={archiveBegins ? formatPublicDate(archiveBegins) : '—'}/><StatCard label="Competitive Series" value={series?.length??0}/><StatCard label="Competitive Games" value={totalGames}/><StatCard label="Known Aliases" value={aliasCount}/></div>
    </PageHero>
    <section className="mt-14"><SectionHeader eyebrow="Explore the archive" title="History Collections" description="Start with an entity, then follow the links deeper through matches, players, opponents, and records."/><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{nav.map(([title,href,copy]) => <Link key={href} href={href} className="group rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:-translate-y-0.5 hover:border-purple-800"><div className="text-xl font-black">{title}</div><p className="mt-2 text-sm text-neutral-500">{copy}</p><div className="mt-4 text-sm text-purple-300">Explore →</div></Link>)}</div></section>
    <section className="mt-16"><SectionHeader eyebrow="Milestones" title="First Recorded Victories" description="Derived only from dated competitive series in the archive."/>{firstWins.size ? <div className="grid gap-4 md:grid-cols-3">{[...firstWins.entries()].map(([team,s]:any) => {const outcome=getSeriesOutcome(s.matches??[]);return <Link key={team} href={`/matches/${s.series_id}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-800"><div className="text-xs font-bold uppercase tracking-wide text-purple-400">First recorded win</div><div className="mt-2 text-2xl font-black">{team}</div><div className="mt-1 text-sm text-neutral-500">vs {s.opponent_name} · {formatPublicDate(s.series_date)}</div><div className="mt-4"><ResultBadge wins={outcome.wins} losses={outcome.losses}/></div></Link>})}</div> : <EmptyState title="Milestones are waiting" description="They will appear when dated competitive results are available."/>}</section>
    <section className="mt-16"><SectionHeader eyebrow="Chronology" title="Recent Archive Entries" description="The latest completed series, preserved as the backbone of the organization timeline." href="/matches" linkLabel="Full match archive"/><div className="relative ml-3 border-l border-purple-900/60 pl-6">{(series??[]).slice(0,12).map((s:any)=>{const outcome=getSeriesOutcome(s.matches??[]);return <Link key={s.series_id} href={`/matches/${s.series_id}`} className="relative mb-4 block rounded-xl border border-neutral-800 bg-[#111] p-4 text-white no-underline hover:border-purple-800"><span className="absolute -left-[31px] top-5 h-3 w-3 rounded-full bg-purple-500"/><div className="text-xs text-neutral-600">{formatPublicDate(s.series_date)} · {s.teams?.format}</div><div className="mt-1 font-bold">{s.teams?.name} vs {s.opponent_name}</div><div className="mt-2"><ResultBadge wins={outcome.wins} losses={outcome.losses}/></div></Link>})}</div></section>
    <section className="mt-16"><SectionHeader eyebrow="Identity" title="Teams Across the Archive"/><div className="flex flex-wrap gap-2">{(teams??[]).map((team:any)=><Link key={team.id} href={`/teams/${encodeURIComponent(team.name)}`} className="rounded-full border border-neutral-700 bg-[#111] px-4 py-2 text-sm font-semibold text-neutral-300 no-underline hover:border-purple-700">{team.name} · {team.format}</Link>)}</div></section>
  </main>
}
