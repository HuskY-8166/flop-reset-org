import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function MatchCenter({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const seriesId = parseInt(id)

  const { data: series } = await supabase
    .from('series')
    .select('series_id, opponent_name, series_date, best_of, notes, teams ( name, format )')
    .eq('series_id', seriesId)
    .single()

  const { data: games } = await supabase
    .from('matches')
    .select('match_id, flop_reset_score, opponent_score, is_forfeit, round, match_date')
    .eq('series_id', seriesId)
    .order('match_id', { ascending: true })

  const gameIds = games?.map((g) => g.match_id) ?? []

  const { data: playerStats } = await supabase
    .from('match_player_stats')
    .select('match_id, goals, assists, saves, shots, score, mvp, players ( name )')
    .in('match_id', gameIds)

  if (!series) {
    return (
      <main className="px-8 py-16 max-w-5xl mx-auto">
        <p className="text-neutral-500">Match not found.</p>
      </main>
    )
  }

  const gamesWon = games?.filter((g) => g.flop_reset_score > g.opponent_score).length ?? 0
  const gamesLost = (games?.length ?? 0) - gamesWon
  const won = gamesWon > gamesLost

  // MVP for the whole series: highest total score across all games
  const scoreByPlayer: Record<string, number> = {}
  playerStats?.forEach((s: any) => {
    const n = s.players?.name
    if (!n) return
    scoreByPlayer[n] = (scoreByPlayer[n] || 0) + (s.score ?? 0)
  })
  const seriesMvp = Object.entries(scoreByPlayer).sort((a, b) => b[1] - a[1])[0]

  return (
    <main className="px-8 py-16 max-w-5xl mx-auto">
      <div className={`rounded-2xl border-2 p-8 text-center mb-10 ${won ? 'border-emerald-600' : 'border-red-600'}`}
        style={{ background: `linear-gradient(135deg, ${won ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)'}, transparent)` }}>
        <div className="text-xs uppercase tracking-widest text-neutral-500 font-bold mb-4">
          {(series.teams as any)?.format} • {series.series_date}
        </div>
        <div className="flex items-center justify-center gap-6 mb-3">
          <span className="text-4xl font-black">{(series.teams as any)?.name}</span>
          <span className="text-3xl font-black" style={{ color: '#AF69EE' }}>{gamesWon}–{gamesLost}</span>
          <span className="text-4xl font-black text-neutral-400">{series.opponent_name}</span>
        </div>
        <span className={`text-sm font-bold uppercase px-3 py-1 rounded ${won ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
          {won ? 'Series Win' : 'Series Loss'}
        </span>
        {series.notes && <p className="text-neutral-500 text-sm mt-3">{series.notes}</p>}
      </div>

      {seriesMvp && (
        <div className="mb-10 text-center">
          <span className="text-sm text-neutral-500 uppercase tracking-wide">Series MVP</span>
          <div className="text-2xl font-bold" style={{ color: '#AF69EE' }}>
            <a href={`/players/${encodeURIComponent(seriesMvp[0])}`} className="hover:underline">{seriesMvp[0]}</a>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4">Game-by-Game</h2>
      <div className="space-y-6 mb-12">
        {games?.map((g, i) => {
          const gameStats = playerStats?.filter((s: any) => s.match_id === g.match_id) ?? []
          const gameWon = g.flop_reset_score > g.opponent_score
          return (
            <div key={g.match_id} className="rounded-xl bg-[#1b1b1b] border border-neutral-800 p-5">
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold">Game {i + 1}{g.round && ` — ${g.round}`}</span>
                <span className={`text-lg font-black ${gameWon ? 'text-emerald-400' : 'text-red-400'}`}>
                  {g.flop_reset_score} – {g.opponent_score} {g.is_forfeit && '(forfeit)'}
                </span>
              </div>
              {gameStats.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-neutral-500 text-xs uppercase">
                      <th className="text-left py-1">Player</th>
                      <th className="text-left py-1">G</th>
                      <th className="text-left py-1">A</th>
                      <th className="text-left py-1">SV</th>
                      <th className="text-left py-1">SH</th>
                      <th className="text-left py-1">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameStats.map((s: any, j: number) => (
                      <tr key={j} className="border-t border-neutral-800">
                        <td className="py-1">
                          <a href={`/players/${encodeURIComponent(s.players?.name)}`} className="hover:underline font-semibold">
                            {s.players?.name}
                          </a>
                          {s.mvp && <span className="text-purple-400 ml-2 text-xs">MVP</span>}
                        </td>
                        <td className="py-1">{s.goals}</td>
                        <td className="py-1">{s.assists}</td>
                        <td className="py-1">{s.saves}</td>
                        <td className="py-1">{s.shots}</td>
                        <td className="py-1">{s.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}