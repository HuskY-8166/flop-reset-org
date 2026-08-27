/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase'
import { formatPublicDate, getSeriesOutcome } from '@/lib/results'

export const dynamic = 'force-dynamic'

export default async function Schedule() {
  const { data: upcoming, error } = await supabase
    .from('scheduled_matches')
    .select('scheduled_id, opponent_name, match_date, match_time, notes, competitions ( name ), teams ( name, format )')
    .eq('status', 'scheduled')
    .order('match_date', { ascending: true })

  const { data: history } = await supabase
    .from('series')
    .select('series_id, opponent_name, series_date, notes, teams ( name, format ), matches ( * )')
    .order('series_date', { ascending: false })

  return (
    <main className="px-4 py-10 md:px-8 md:py-14 max-w-6xl mx-auto">
      <div className="mb-10 rounded-3xl border border-neutral-800 bg-gradient-to-br from-[#171717] to-[#0d0d0d] p-6 md:p-9"><div className="text-xs font-bold uppercase tracking-[.22em] text-purple-400">What’s next</div><h1 className="mt-2 text-4xl font-bold md:text-6xl">Match <span style={{ color: '#AF69EE' }}>Schedule</span></h1><p className="mt-2 text-neutral-400">Upcoming Flop Reset fixtures, with completed history one click away.</p></div>
      {error && <div className="rounded-xl border border-red-900 bg-red-950/20 p-4 text-red-300">Something went wrong while loading the schedule. Please try again shortly.</div>}

      <div className="space-y-4 mb-10">
        {(!upcoming || upcoming.length === 0) && (
          <div className="rounded-xl border border-neutral-800 bg-[#111] p-6 text-neutral-500">No upcoming match is currently scheduled.</div>
        )}
        {upcoming?.map((m) => (
          <div key={m.scheduled_id} className={`rounded-2xl border p-5 ${m === upcoming[0] ? 'border-purple-700 bg-purple-950/20 md:p-8' : 'border-neutral-800 bg-[#111]'}`}>
            {m === upcoming[0] && <div className="mb-3 text-xs font-black uppercase tracking-wider text-purple-400">Next Match</div>}
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-xl md:text-2xl font-bold">
                <a href={`/teams/${encodeURIComponent((m.teams as any)?.name ?? '')}`} className="text-white hover:underline">{(m.teams as any)?.name}</a> <span className="text-neutral-600">vs</span> {m.opponent_name ?? 'Opponent TBD'}
              </h2>
              <span className="text-sm text-neutral-400">{(m.competitions as any)?.name}</span>
            </div>
            <p className="text-neutral-300">
              {formatPublicDate(m.match_date)} {m.match_time && `— ${m.match_time}`}
            </p>
            {m.notes && <p className="text-neutral-500 text-sm mt-1">{m.notes}</p>}
          </div>
        ))}
      </div>

      <details className="group">
        <summary className="cursor-pointer text-lg font-semibold text-neutral-300 hover:text-white select-none mb-4">
          History <span className="text-sm text-neutral-500 group-open:hidden">(click to expand)</span>
        </summary>
        <div className="space-y-4 mt-4">
          {(!history || history.length === 0) && (
            <p className="text-neutral-500">No past matches yet.</p>
          )}
          {history?.map((s) => {
            const outcome = getSeriesOutcome((s.matches as any[]) ?? [], s as any)
            return (
              <a href={`/matches/${s.series_id}`} key={s.series_id} className="block rounded-xl bg-[#111] border border-neutral-800 p-5 no-underline hover:bg-neutral-900">
                <div className="flex items-baseline justify-between mb-1">
                  <h2 className="text-xl font-bold">
                    {(s.teams as any)?.name} ({(s.teams as any)?.format}) vs {s.opponent_name} — {outcome.result} ({outcome.forfeits ? 'SERIES FORFEIT · 0–0 games' : outcome.displayRecord})
                  </h2>
                </div>
                <p className="text-neutral-300">{formatPublicDate(s.series_date)}</p>
              </a>
            )
          })}
        </div>
      </details>
    </main>
  )
}
