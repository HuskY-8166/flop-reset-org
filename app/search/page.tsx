/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { EmptyState, PageHero, SectionHeader } from '@/components/ui'
export const dynamic = 'force-dynamic'

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw = '' } = await searchParams, q = raw.trim(), needle = q.toLowerCase()
  const [{ data: players }, { data: teams }, { data: competitions }, { data: series }] = q.length >= 2 ? await Promise.all([
    supabase.from('players').select('name, aliases, teams ( name, format )'),
    supabase.from('teams').select('id, name, format, players ( name )'),
    supabase.from('competitions').select('id, name, format'),
    supabase.from('series').select('series_id, opponent_name, series_date, teams ( name, format )'),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]
  const playerResults = (players ?? []).filter((p:any) => p.name?.toLowerCase().includes(needle) || p.aliases?.some((alias:string) => alias.toLowerCase().includes(needle)))
  const teamResults = (teams ?? []).filter((t:any) => t.name?.toLowerCase().includes(needle))
  const competitionResults = (competitions ?? []).filter((c:any) => c.name?.toLowerCase().includes(needle))
  const opponentGroups = new Map<string,any[]>()
  ;(series ?? []).filter((s:any) => s.opponent_name?.toLowerCase().includes(needle)).forEach((s:any) => opponentGroups.set(s.opponent_name, [...(opponentGroups.get(s.opponent_name) ?? []), s]))
  const total = playerResults.length + teamResults.length + competitionResults.length + opponentGroups.size

  return <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
    <PageHero eyebrow="Global archive search" title="Search Flop Reset" description="Find players and aliases, teams, competitions, and opponents across the competitive archive.">
      <form action="/search" className="flex max-w-2xl rounded-xl border border-neutral-700 bg-black/40 p-1"><input autoFocus name="q" defaultValue={q} placeholder="Try Ghost, MIDLADS, Frameshift…" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-white focus:outline-none"/><button className="rounded-lg bg-purple-700 px-5 py-3 font-bold text-white">Search</button></form>
    </PageHero>
    <div className="mt-10">{q.length < 2 ? <EmptyState title="Enter at least two characters" description="Search recognizes canonical player names, import aliases, teams, competitions, and recorded opponents."/> : total === 0 ? <EmptyState title={`No results for “${q}”`} description="Try a shorter player name, team name, alias, competition, or opponent."/> : <div className="space-y-12">
      {playerResults.length > 0 && <section><SectionHeader eyebrow="People" title="Players"/><div className="grid gap-3 md:grid-cols-2">{playerResults.map((p:any) => <Link key={`${p.name}-${p.teams?.format}`} href={`/players/${encodeURIComponent(p.name)}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-800"><div className="text-xl font-black">{p.name}</div><div className="mt-1 text-sm text-neutral-500">{p.teams?.name} · {p.teams?.format}</div>{p.aliases?.length > 0 && <div className="mt-2 text-xs text-neutral-600">Aliases: {p.aliases.join(', ')}</div>}</Link>)}</div></section>}
      {teamResults.length > 0 && <section><SectionHeader eyebrow="Squads" title="Teams"/><div className="grid gap-3 md:grid-cols-2">{teamResults.map((t:any) => <Link key={t.id} href={`/teams/${encodeURIComponent(t.name)}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-800"><div className="text-xl font-black">{t.name}</div><div className="mt-1 text-sm text-neutral-500">{t.format} · {(t.players ?? []).length} registered players</div></Link>)}</div></section>}
      {competitionResults.length > 0 && <section><SectionHeader eyebrow="Leagues & tournaments" title="Competitions"/><div className="grid gap-3 md:grid-cols-2">{competitionResults.map((c:any) => <Link key={c.id} href={`/competitions/${c.id}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-800"><div className="text-xl font-black">{c.name}</div><div className="mt-1 text-sm text-neutral-500">{c.format}</div></Link>)}</div></section>}
      {opponentGroups.size > 0 && <section><SectionHeader eyebrow="Head-to-head history" title="Opponents"/><div className="grid gap-3 md:grid-cols-2">{[...opponentGroups.entries()].map(([name,meetings]) => <Link key={name} href={`/rivalries/${encodeURIComponent(name)}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-800"><div className="text-xl font-black">{name}</div><div className="mt-1 text-sm text-neutral-500">{meetings.length} recorded series · latest {meetings[0]?.series_date}</div></Link>)}</div></section>}
    </div>}</div>
  </main>
}
