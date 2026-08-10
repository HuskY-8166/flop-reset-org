import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export default async function Standings() {
  const { data: teams, error } = await supabase
    .from('teams')
    .select(`
      id,
      name,
      format,
      series ( series_id, matches ( flop_reset_score, opponent_score ) )
    `)
    .order('name')

  const standings = teams?.map((team) => {
    let seriesWon = 0
    let seriesLost = 0
    let gamesWon = 0
    let gamesLost = 0

    ;(team.series as any)?.forEach((s: any) => {
      const gWon = (s.matches as any)?.filter((m: any) => m.flop_reset_score > m.opponent_score).length ?? 0
      const gLost = ((s.matches as any)?.length ?? 0) - gWon
      gamesWon += gWon
      gamesLost += gLost
      if (gWon > gLost) seriesWon++
      else seriesLost++
    })

    return { ...team, seriesWon, seriesLost, gamesWon, gamesLost }
  })

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Standings</h1>
      {error && <p>Error: {error.message}</p>}
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333', textAlign: 'left' }}>
            <th style={{ padding: '0.5rem' }}>Team</th>
            <th>Format</th>
            <th>Series Record</th>
            <th>Game Record</th>
          </tr>
        </thead>
        <tbody>
          {standings?.map((t) => (
            <tr key={t.id} style={{ borderBottom: '1px solid #222' }}>
              <td style={{ padding: '0.5rem' }}>{t.name}</td>
              <td>{t.format}</td>
              <td>{t.seriesWon}-{t.seriesLost}</td>
              <td>{t.gamesWon}-{t.gamesLost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}