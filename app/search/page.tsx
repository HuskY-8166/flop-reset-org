/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { EmptyState, PageHero, SectionHeader } from '@/components/ui'
import { formatPublicDate } from '@/lib/results'
import { normalizeIdentity } from '@/lib/stats'
import { competitionIdentity } from '@/lib/competitions'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw = '' } = await searchParams
  const q = raw.trim()
  const needle = q.toLocaleLowerCase('en-US')
  const normalizedNeedle = normalizeIdentity(q)
  const [{ data: players }, { data: teams }, { data: competitions }, { data: series }, { data: opponents }, { data: opponentAliases }, { data: leagueEntries }, { data: leaguePlayers }] = q.length >= 2 ? await Promise.all([
    supabase.from('players').select('name, aliases, teams ( name, format )'),
    supabase.from('teams').select('id, name, format, players ( name )'),
    supabase.from('competitions').select('*'),
    supabase.from('series').select('series_id, opponent_id, opponent_name, series_date, teams ( name, format )').order('series_date', { ascending: false }),
    supabase.from('opponents').select('*'),
    supabase.from('opponent_aliases').select('*'),
    supabase.from('public_competition_entries').select('entry_id, slug, display_name_snapshot, tier, fr_team_id, opponent_id, competition_name, competition_format, competition_league_name, competition_circuit_name, competition_season_year, competition_region'),
    supabase.from('public_league_players').select('league_player_id, slug, canonical_name, display_name, aliases, linked_fr_player_id'),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }]

  const playerGroups = new Map<string, { name: string; aliases: Set<string>; teams: Set<string>; formats: Set<string> }>()
  for (const player of (players ?? []) as any[]) {
    const matches = player.name?.toLocaleLowerCase('en-US').includes(needle) || player.aliases?.some((alias: string) => alias.toLocaleLowerCase('en-US').includes(needle))
    if (!matches) continue
    const key = normalizeIdentity(player.name)
    const row = playerGroups.get(key) ?? { name: player.name, aliases: new Set<string>(), teams: new Set<string>(), formats: new Set<string>() }
    for (const alias of player.aliases ?? []) row.aliases.add(alias)
    if (player.teams?.name) row.teams.add(player.teams.name)
    if (player.teams?.format) row.formats.add(player.teams.format)
    playerGroups.set(key, row)
  }

  const teamGroups = new Map<string, { name: string; formats: Set<string>; players: Set<string> }>()
  for (const team of (teams ?? []).filter((entry: any) => entry.name?.toLocaleLowerCase('en-US').includes(needle)) as any[]) {
    const key = normalizeIdentity(team.name)
    const row = teamGroups.get(key) ?? { name: team.name, formats: new Set<string>(), players: new Set<string>() }
    row.formats.add(team.format)
    for (const player of team.players ?? []) row.players.add(player.name)
    teamGroups.set(key, row)
  }

  const competitionResults = (competitions ?? []).filter((competition: any) => {
    const identity = competitionIdentity(competition)
    return [competition.name, identity.league, identity.circuit, identity.year, identity.format].some((value) => String(value ?? '').toLocaleLowerCase('en-US').includes(needle))
  })
  const opponentById = new Map((opponents ?? []).map((opponent: any) => [String(opponent.opponent_id ?? opponent.id), opponent]))
  const aliasesByOpponent = new Map<string, Set<string>>()
  for (const alias of opponentAliases ?? []) {
    const row = alias as any
    const id = String(row.opponent_id)
    const value = row.alias ?? row.alias_name ?? row.name
    if (value) aliasesByOpponent.set(id, new Set([...(aliasesByOpponent.get(id) ?? []), value]))
  }
  const opponentGroups = new Map<string, { name: string; aliases: Set<string>; meetings: any[] }>()
  for (const meeting of (series ?? []) as any[]) {
    const opponent = opponentById.get(String(meeting.opponent_id)) as any
    const canonicalName = opponent?.canonical_name ?? opponent?.name ?? opponent?.display_name ?? meeting.opponent_name
    const knownAliases = new Set([meeting.opponent_name, ...(aliasesByOpponent.get(String(meeting.opponent_id)) ?? [])].filter(Boolean))
    if (![canonicalName, ...knownAliases].some((value) => value.toLocaleLowerCase('en-US').includes(needle) || normalizeIdentity(value).includes(normalizedNeedle))) continue
    const key = meeting.opponent_id ? `id:${meeting.opponent_id}` : normalizeIdentity(canonicalName)
    const row: { name: string; aliases: Set<string>; meetings: any[] } = opponentGroups.get(key) ?? { name: canonicalName, aliases: new Set<string>(), meetings: [] }
    for (const alias of knownAliases) row.aliases.add(alias)
    row.meetings.push(meeting)
    opponentGroups.set(key, row)
  }

  const leagueTeamResults = (leagueEntries ?? []).filter((entry: any) => entry.display_name_snapshot?.toLocaleLowerCase('en-US').includes(needle))
  const leaguePlayerResults = (leaguePlayers ?? []).filter((player: any) => [player.canonical_name, player.display_name, ...(player.aliases ?? [])].some((value) => String(value ?? '').toLocaleLowerCase('en-US').includes(needle)))
  const total = playerGroups.size + teamGroups.size + competitionResults.length + opponentGroups.size + leagueTeamResults.length + leaguePlayerResults.length

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <PageHero eyebrow="Global archive search" title="Search Flop Reset" description="Find players and aliases, teams, competitions, and opponents across the competitive archive.">
        <form action="/search" className="flex max-w-2xl rounded-xl border border-neutral-700 bg-black/40 p-1"><input autoFocus name="q" defaultValue={q} aria-label="Search the Flop Reset archive" placeholder="Try Ghost, MIDLADS, Frameshift…" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-white focus:outline-none"/><button className="rounded-lg bg-purple-700 px-5 py-3 font-bold text-white">Search</button></form>
      </PageHero>

      <div className="mt-10">{q.length < 2 ? <EmptyState title="Enter at least two characters" description="Search recognizes canonical player names, aliases, teams, competitions, and recorded opponents."/> : total === 0 ? <EmptyState title={`No results for “${q}”`} description="Try a shorter player name, team name, alias, competition, or opponent."/> : <div className="space-y-12">
        {playerGroups.size ? <section><SectionHeader eyebrow="People" title="Players"/><div className="grid gap-3 md:grid-cols-2">{[...playerGroups.values()].map((player) => <Link key={normalizeIdentity(player.name)} href={`/players/${encodeURIComponent(player.name)}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-800"><div className="text-xl font-black">{player.name}</div><div className="mt-1 text-sm text-neutral-500">{[...player.teams].join(' / ')} · {[...player.formats].join(' · ')}</div>{player.aliases.size ? <div className="mt-2 text-xs text-neutral-600">Aliases: {[...player.aliases].join(', ')}</div> : null}</Link>)}</div></section> : null}
        {teamGroups.size ? <section><SectionHeader eyebrow="Squads" title="Teams"/><div className="grid gap-3 md:grid-cols-2">{[...teamGroups.values()].map((team) => <Link key={normalizeIdentity(team.name)} href={`/teams/${encodeURIComponent(team.name)}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-800"><div className="text-xl font-black">{team.name}</div><div className="mt-1 text-sm text-neutral-500">{[...team.formats].join(' · ')} · {team.players.size} registered players</div></Link>)}</div></section> : null}
        {leagueTeamResults.length ? <section><SectionHeader eyebrow="Competition directory" title="League Teams"/><div className="grid gap-3 md:grid-cols-2">{leagueTeamResults.map((entry: any) => { const competition = { name: entry.competition_name, format: entry.competition_format, league_name: entry.competition_league_name, circuit_name: entry.competition_circuit_name, season_year: entry.competition_season_year, region: entry.competition_region }; const context = competitionIdentity(competition); return <Link key={entry.entry_id} href={`/league/teams/${entry.slug}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-800"><div className="text-xl font-black">{entry.display_name_snapshot}</div><div className="mt-1 text-sm text-neutral-500">League Team · {context.league} · {entry.competition_region ?? 'Region TBD'} · {entry.competition_format ?? 'Format TBD'}{entry.tier ? ` · Tier ${entry.tier}` : ''}</div></Link> })}</div></section> : null}
        {leaguePlayerResults.length ? <section><SectionHeader eyebrow="League identities" title="League Players"/><div className="grid gap-3 md:grid-cols-2">{leaguePlayerResults.map((player: any) => <Link key={player.league_player_id} href={`/league/players/${player.slug}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-800"><div className="text-xl font-black">{player.display_name || player.canonical_name}</div><div className="mt-1 text-sm text-neutral-500">League Player{player.linked_fr_player_id ? ' · Linked to FR identity' : ''}</div></Link>)}</div></section> : null}
        {competitionResults.length ? <section><SectionHeader eyebrow="Leagues & tournaments" title="Competitions"/><div className="grid gap-3 md:grid-cols-2">{competitionResults.map((competition: any) => { const identity = competitionIdentity(competition); return <Link key={competition.id} href={`/competitions/${competition.id}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-800"><div className="text-xl font-black">{identity.league}</div><div className="mt-1 text-sm text-neutral-500">{identity.seasonLabel} · {identity.format}</div></Link> })}</div></section> : null}
        {opponentGroups.size ? <section><SectionHeader eyebrow="Head-to-head history" title="Opponents"/><div className="grid gap-3 md:grid-cols-2">{[...opponentGroups.values()].map((opponent) => <Link key={normalizeIdentity(opponent.name)} href={`/rivalries/${encodeURIComponent(opponent.name)}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-800"><div className="text-xl font-black">{opponent.name}</div><div className="mt-1 text-sm text-neutral-500">{opponent.meetings.length} recorded series · latest {formatPublicDate(opponent.meetings[0]?.series_date)}</div>{opponent.aliases.size > 1 ? <div className="mt-2 text-xs text-neutral-600">Recorded names: {[...opponent.aliases].join(', ')}</div> : null}</Link>)}</div></section> : null}
      </div>}</div>
    </main>
  )
}
