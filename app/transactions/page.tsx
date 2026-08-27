/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { EmptyState, PageHero, SectionHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

type Event = { key: string; date: string; player: string; team: string; format: string; kind: string; verified: boolean }

export default async function Transactions() {
  const [{ data: memberships }, { data: players }, { data: teams }, { data: stats }] = await Promise.all([
    supabase.from('player_team_memberships').select('*'),
    supabase.from('players').select('player_id, name'),
    supabase.from('teams').select('team_id, name, format'),
    supabase.from('match_player_stats').select('player_id, players ( name, teams ( name, format ) ), matches ( match_date )'),
  ])
  const playerById = new Map((players ?? []).map((player: any) => [String(player.player_id), player.name]))
  const teamById = new Map((teams ?? []).map((team: any) => [String(team.team_id), team]))
  const events: Event[] = []

  for (const membership of memberships ?? []) {
    const player = playerById.get(String((membership as any).player_id))
    const team = teamById.get(String((membership as any).team_id))
    if (!player || !team) continue
    const joined = (membership as any).joined_at ?? (membership as any).start_date
    const left = (membership as any).left_at ?? (membership as any).end_date
    if (joined) events.push({ key: `join-${(membership as any).membership_id ?? `${player}-${team.name}-${joined}`}`, date: joined, player, team: team.name, format: team.format, kind: 'Joined roster', verified: true })
    if (left) events.push({ key: `left-${(membership as any).membership_id ?? `${player}-${team.name}-${left}`}`, date: left, player, team: team.name, format: team.format, kind: 'Left roster', verified: true })
  }

  const first = new Map<string, Event>()
  for (const row of stats ?? []) {
    const entry = row as any
    const player = entry.players?.name
    const team = entry.players?.teams?.name
    const format = entry.players?.teams?.format
    const date = entry.matches?.match_date
    if (!player || !team || !format || !date) continue
    const key = `${player}|${format}`
    const current = first.get(key)
    if (!current || date < current.date) first.set(key, { key: `appearance-${key}`, date, player, team, format, kind: 'First recorded appearance', verified: false })
  }
  const datedMemberships = new Set(events.map((event) => `${event.player}|${event.format}`))
  for (const [key, event] of first) if (!datedMemberships.has(key)) events.push(event)
  events.sort((a, b) => b.date.localeCompare(a.date) || a.player.localeCompare(b.player))

  return <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14"><PageHero eyebrow="Roster history" title="Transactions" description="Dated membership changes are canonical. Where roster dates are unavailable, the archive clearly falls back to first recorded competitive appearance rather than inventing a signing date." />
    <section className="mt-12"><SectionHeader eyebrow="Historical timeline" title="Roster Activity" description="Verified membership dates and appearance-based evidence are labeled separately." />{events.length ? <div className="relative ml-3 border-l border-purple-900/60 pl-6">{events.map((event) => <article key={event.key} className="relative mb-4 rounded-xl border border-neutral-800 bg-[#111] p-4"><span className={`absolute -left-[31px] top-5 h-3 w-3 rounded-full ${event.verified ? 'bg-purple-500' : 'bg-neutral-600'}`} /><div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500"><span>{event.date}</span><span>·</span><span>{event.kind}</span><span className={`rounded-full px-2 py-0.5 font-bold ${event.verified ? 'bg-purple-950 text-purple-300' : 'bg-neutral-800 text-neutral-400'}`}>{event.verified ? 'Roster record' : 'Appearance evidence'}</span></div><Link href={`/players/${encodeURIComponent(event.player)}`} className="mt-1 inline-block text-lg font-bold text-white hover:underline">{event.player}</Link><div className="text-sm text-neutral-500">{event.team} · {event.format}</div></article>)}</div> : <EmptyState title="No roster history yet" description="This page will populate when dated memberships or competitive appearances are recorded." />}</section>
    {!events.some((event) => event.verified) && <div className="mt-12 rounded-2xl border border-amber-900/40 bg-amber-950/10 p-5"><h2 className="font-bold text-amber-300">No dated roster changes yet</h2><p className="mt-2 text-sm text-neutral-500">Current membership rows have no join or leave dates. The appearances above prove participation only and are not presented as transactions.</p></div>}
  </main>
}
