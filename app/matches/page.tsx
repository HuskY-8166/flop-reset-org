import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export default async function Matches() {
  const { data: series, error } = await supabase
    .from('series')
    .select(`
      series_id,
      opponent_name,
      best_of,
      series_date,
      notes,
      teams ( name, format ),
      matches ( match_id, flop_reset_score, opponent_score, is_forfeit )
    `)
    .order('series_date', { ascending: false })

  return (
    <main className="px-8 py-12 max-w-6xl mx-auto">
      <h1 className="text-6xl font-black tracking-tight mb-2">Match <span style={{ color: '#AF69EE' }}>History</span></h1>
      <p className="text-neutral-400 mb-10">Every result, permanently recorded</p>
      {error && <p>Error: {error.message}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {series?.map((s) => {
          const gamesWon = s.matches?.filter((m) => m.flop_reset_score > m.opponent_score).length ?? 0
          const gamesLost = (s.matches?.length ?? 0) - gamesWon
          const won = gamesWon > gamesLost

          return (
            <a
              href={`/matches/${s.series_id}`}
              key={s.series_id}
              className={`block no-underline rounded-xl bg-neutral-900 border-l-4 p-6 hover:bg-neutral-800 transition-colors ${won ? 'border-emerald-500' : 'border-red-500'}`}
            >
                          <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-wide text-neutral-500">
                  {(s.teams as any)?.format} • {s.series_date}
                </span>
                <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${won ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
                  {won ? 'Win' : 'Loss'}
                </span>
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold">{(s.teams as any)?.name}</span>
                <span className="text-3xl font-black text-neutral-500">{gamesWon}-{gamesLost}</span>
                <span className="text-2xl font-bold text-neutral-300">{s.opponent_name}</span>
              </div>

              <div className="space-y-1 border-t border-neutral-800 pt-3">
                {s.matches?.map((m, i) => (
                  <div key={m.match_id} className="text-sm text-neutral-400 flex justify-between">
                    <span>Game {i + 1}</span>
                    <span>{m.flop_reset_score} — {m.opponent_score} {m.is_forfeit && '(forfeit)'}</span>
                  </div>
                ))}
              </div>

              {s.notes && <p className="text-xs text-neutral-600 mt-3">{s.notes}</p>}
            </a>
          )
        })}
      </div>
    </main>
  )
}