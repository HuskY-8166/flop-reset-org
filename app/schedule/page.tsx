import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function Schedule() {
  const { data: upcoming, error } = await supabase
    .from('scheduled_matches')
    .select('scheduled_id, opponent_name, match_date, match_time, notes, competitions ( name ), teams ( name, format )')
    .eq('status', 'scheduled')
    .order('match_date', { ascending: true })

  const { data: history } = await supabase
    .from('series')
    .select('series_id, opponent_name, series_date, teams ( name, format ), matches ( flop_reset_score, opponent_score, is_forfeit )')
    .order('series_date', { ascending: false })

  return (
    <main className="px-8 py-12 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">Upcoming <span style={{ color: '#AF69EE' }}>Schedule</span></h1>
      <p className="text-neutral-400 mb-10">What's coming up for Flop Reset</p>
      {error && <p>Error: {error.message}</p>}

      <div className="space-y-4 mb-10">
        {(!upcoming || upcoming.length === 0) && (
          <p className="text-neutral-500">Nothing scheduled right now.</p>
        )}
        {upcoming?.map((m) => (
          <div key={m.scheduled_id} className="rounded-xl bg-neutral-900 border border-neutral-800 p-5">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-xl font-bold">
                {(m.teams as any)?.name} ({(m.teams as any)?.format}) vs {m.opponent_name ?? 'TBD'}
              </h2>
              <span className="text-sm text-neutral-400">{(m.competitions as any)?.name}</span>
            </div>
            <p className="text-neutral-300">
              {m.match_date} {m.match_time && `— ${m.match_time}`}
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
            const gamesWon = (s.matches as any)?.filter((m: any) => m.flop_reset_score > m.opponent_score).length ?? 0
            const gamesLost = ((s.matches as any)?.length ?? 0) - gamesWon
            const result = gamesWon > gamesLost ? 'W' : 'L'
            return (
              <div key={s.series_id} className="rounded-xl bg-neutral-900 border border-neutral-800 p-5">
                <div className="flex items-baseline justify-between mb-1">
                  <h2 className="text-xl font-bold">
                    {(s.teams as any)?.name} ({(s.teams as any)?.format}) vs {s.opponent_name} — {result} ({gamesWon}-{gamesLost})
                  </h2>
                </div>
                <p className="text-neutral-300">{s.series_date}</p>
              </div>
            )
          })}
        </div>
      </details>
    </main>
  )
}