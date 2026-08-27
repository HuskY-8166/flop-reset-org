'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { FLOP_RESET_PLAYOFF_TEAMS, isFlopResetTeam, playoffTeamState, shortFlopTeam, type PublicPlayoffBracket } from '@/lib/playoffs'

function displayTime(value: string | null) {
  if (!value) return 'Time TBD'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(parsed)
}

export function PlayoffBracket({ brackets }: { brackets: PublicPlayoffBracket[] }) {
  const [teamFilter, setTeamFilter] = useState('All')
  const pathIds = useMemo(() => {
    if (teamFilter === 'All') return new Set<number>()
    const allMatches = brackets.flatMap((bracket) => bracket.matches)
    const byId = new Map(allMatches.map((match) => [match.id, match]))
    const ids = new Set(allMatches.filter((match) => shortFlopTeam(match.teamA) === teamFilter || shortFlopTeam(match.teamB) === teamFilter).map((match) => match.id))
    const queue = [...ids]
    while (queue.length) {
      const match = byId.get(queue.shift()!)
      for (const nextId of [match?.nextMatchId, match?.loserNextMatchId]) {
        if (!nextId || ids.has(nextId)) continue
        ids.add(nextId)
        queue.push(nextId)
      }
    }
    return ids
  }, [brackets, teamFilter])

  const watch = FLOP_RESET_PLAYOFF_TEAMS.map((team) => playoffTeamState(team, brackets))

  return <>
    <section className="mt-10">
      <div className="text-xs font-black uppercase tracking-[.22em] text-purple-400">Flop Reset Playoff Watch</div>
      <h2 className="mt-1 text-3xl font-black text-white">The organization’s paths</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-3">{watch.map((entry) => <article key={entry.team} className="rounded-2xl border border-purple-900/70 bg-purple-950/15 p-5"><div className="flex items-center justify-between gap-3"><h3 className="text-2xl font-black text-white">{entry.team}</h3><span className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold text-purple-200">{entry.status}</span></div><dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm"><dt className="text-neutral-600">Tier</dt><dd className="text-right text-neutral-300">{entry.tier}</dd><dt className="text-neutral-600">Stage</dt><dd className="text-right text-neutral-300">{entry.round}</dd><dt className="text-neutral-600">Opponent</dt><dd className="text-right font-semibold text-white">{entry.opponent}</dd><dt className="text-neutral-600">Next time</dt><dd className="text-right text-neutral-300">{displayTime(entry.startsAt)}</dd></dl></article>)}</div>
    </section>

    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[.22em] text-purple-400">Team path filter</div><h2 className="mt-1 text-3xl font-black text-white">Tournament Brackets</h2></div><div className="flex flex-wrap gap-2" aria-label="Highlight a Flop Reset playoff path">{['All', ...FLOP_RESET_PLAYOFF_TEAMS].map((team) => <button key={team} type="button" onClick={() => setTeamFilter(team)} aria-pressed={teamFilter === team} className={`rounded-full px-4 py-2 text-sm font-bold ${teamFilter === team ? 'bg-purple-700 text-white' : 'border border-neutral-700 bg-[#111] text-neutral-400'}`}>{team}</button>)}</div></div>

      {brackets.length === 0 ? <div className="mt-6 rounded-3xl border border-dashed border-amber-800/70 bg-amber-950/10 p-8 text-center"><h3 className="text-2xl font-black text-white">Awaiting verified playoff seeds</h3><p className="mx-auto mt-2 max-w-2xl text-sm text-neutral-400">No official bracket has been recorded yet. Fracture, Frantic, and Frameshift will appear here after their tier assignments and opening slots are confirmed.</p></div> : <div className="mt-6 space-y-8">{brackets.map((bracket) => {
        const rounds = [...new Set(bracket.matches.map((match) => match.roundName))]
        return <article key={bracket.id} className="rounded-3xl border border-neutral-800 bg-[#0f0f0f] p-4 md:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-[.18em] text-purple-400">{bracket.tier}</div><h3 className="mt-1 text-2xl font-black text-white">{bracket.name}</h3></div><span className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-bold uppercase text-neutral-400">{bracket.status}</span></div><div className="mt-6 overflow-x-auto pb-3"><div className="grid min-w-max auto-cols-[minmax(245px,285px)] grid-flow-col gap-5">{rounds.map((round) => <section key={round}><h4 className="mb-3 text-sm font-black uppercase tracking-[.14em] text-neutral-500">{round}</h4><div className="space-y-4">{bracket.matches.filter((match) => match.roundName === round).map((match) => {
          const relevant = teamFilter === 'All' || pathIds.has(match.id)
          const linkedHref = match.seriesId ? `/matches/${match.seriesId}` : match.scheduledMatchId ? '/schedule' : null
          const card = <div className={`rounded-2xl border p-4 transition ${relevant ? isFlopResetTeam(match.teamA) || isFlopResetTeam(match.teamB) ? 'border-purple-700 bg-purple-950/25' : 'border-neutral-800 bg-[#151515]' : 'border-neutral-900 bg-[#111] opacity-35'}`}><div className="flex items-center justify-between gap-3 text-xs text-neutral-600"><span>Match {match.matchOrder || 'TBD'}</span><span>{match.isBye ? 'BYE' : match.isForfeit ? 'FORFEIT' : match.status}</span></div>{[[match.teamA, match.scoreA], [match.teamB, match.scoreB]].map(([team, score], index) => <div key={`${team}-${index}`} className={`mt-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${isFlopResetTeam(String(team)) ? 'bg-purple-900/30 text-white' : 'bg-black/20 text-neutral-300'}`}><span className="font-bold">{team}</span><span className="font-black">{score ?? '—'}</span></div>)}<div className="mt-3 flex items-center justify-between gap-2 text-xs"><span className="text-neutral-600">{displayTime(match.startsAt)}</span>{match.resultLabel && <span className="font-bold text-purple-300">{match.resultLabel}</span>}</div></div>
          return linkedHref ? <Link key={match.id} href={linkedHref} className="block text-white no-underline">{card}</Link> : <div key={match.id}>{card}</div>
        })}</div></section>)}</div></div></article>
      })}</div>}
    </section>
  </>
}
