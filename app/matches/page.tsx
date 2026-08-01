import { supabase } from '@/lib/supabase'

export default async function Matches() {
  const { data: matches, error } = await supabase
    .from('matches')
    .select(`
      match_id,
      opponent_name,
      flop_reset_score,
      opponent_score,
      match_date,
      is_forfeit,
      notes,
      teams ( name, format )
    `)
    .order('match_date', { ascending: false })

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Match History</h1>
      {error && <p>Error: {error.message}</p>}
      <ul>
        {matches?.map((m) => (
          <li key={m.match_id} style={{ marginBottom: '1rem' }}>
             <strong>{(m.teams as any)?.name} ({(m.teams as any)?.format})</strong> vs {m.opponent_name}           
                <br />
            {m.flop_reset_score} — {m.opponent_score} {m.is_forfeit && '(forfeit)'}
            <br />
            {m.match_date} {m.notes && `— ${m.notes}`}
          </li>
        ))}
      </ul>
    </main>
  )
}