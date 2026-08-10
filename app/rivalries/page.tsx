import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export default async function Rivalries() {
  const { data: series } = await supabase
    .from('series')
    .select('opponent_name, teams ( name, format ), matches ( flop_reset_score, opponent_score )')

  const rivalries: Record<string, { wins: number; losses: number; games: number }> = {}

  series?.forEach((s: any) => {
    const key = s.opponent_name
    if (!rivalries[key]) rivalries[key] = { wins: 0, losses: 0, games: 0 }

    const gamesWon = (s.matches as any)?.filter((m: any) => m.flop_reset_score > m.opponent_score).length ?? 0
    const gamesLost = ((s.matches as any)?.length ?? 0) - gamesWon

    rivalries[key].games += (s.matches as any)?.length ?? 0
    if (gamesWon > gamesLost) rivalries[key].wins++
    else rivalries[key].losses++
  })

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Rivalries</h1>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333', textAlign: 'left' }}>
            <th style={{ padding: '0.5rem' }}>Opponent</th>
            <th>Series Record</th>
            <th>Total Games</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(rivalries).map(([opponent, r]) => (
            <tr key={opponent} style={{ borderBottom: '1px solid #222' }}>
              <td style={{ padding: '0.5rem' }}>{opponent}</td>
              <td>{r.wins}-{r.losses}</td>
              <td>{r.games}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}