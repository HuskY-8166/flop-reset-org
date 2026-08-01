import { supabase } from '@/lib/supabase'

export default async function PlayerProfile({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const playerName = decodeURIComponent(name)

  const { data: playerRows } = await supabase
    .from('players')
    .select('player_id, name, team_id, teams ( name, format )')
    .eq('name', playerName)

  const { data: stats } = await supabase
    .from('match_player_stats')
    .select('goals, assists, saves, shots, score, mvp, matches ( match_date, opponent_name )')
    .in('player_id', playerRows?.map((p) => p.player_id) ?? [])

  const totals = stats?.reduce(
    (acc, s) => ({
      goals: acc.goals + (s.goals ?? 0),
      assists: acc.assists + (s.assists ?? 0),
      saves: acc.saves + (s.saves ?? 0),
      shots: acc.shots + (s.shots ?? 0),
      mvps: acc.mvps + (s.mvp ? 1 : 0),
      games: acc.games + 1,
    }),
    { goals: 0, assists: 0, saves: 0, shots: 0, mvps: 0, games: 0 }
  )

  return (
    <main style={{ padding: '2rem' }}>
      <h1>{playerName}</h1>
      <p>
        {playerRows?.map((p) => `${p.teams?.name} (${p.teams?.format})`).join(' / ')}
      </p>

      <h2>Career Totals</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
        gap: '1rem',
        maxWidth: '600px',
        marginBottom: '2rem'
      }}>
        {[
          { label: 'Games', value: totals?.games ?? 0 },
          { label: 'Goals', value: totals?.goals ?? 0 },
          { label: 'Assists', value: totals?.assists ?? 0 },
          { label: 'Saves', value: totals?.saves ?? 0 },
          { label: 'Shots', value: totals?.shots ?? 0 },
          { label: 'MVPs', value: totals?.mvps ?? 0 },
        ].map((stat) => (
          <div key={stat.label} style={{
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '1rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{stat.value}</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <h2>Game Log</h2>
      <ul>
        {stats?.map((s, i) => (
          <li key={i}>
            {s.matches?.match_date} vs {s.matches?.opponent_name} — {s.goals}G {s.assists}A {s.saves}S {s.mvp && '(MVP)'}
          </li>
        ))}
      </ul>
    </main>
  )
}