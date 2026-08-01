import { supabase } from '@/lib/supabase'

export default async function Teams() {
  const { data: teams, error } = await supabase
    .from('teams')
    .select(`
      id,
      name,
      format,
      captain,
      players ( name )
    `)
    .order('name')

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Teams</h1>
      {error && <p>Error: {error.message}</p>}
      {teams?.map((team) => (
        <div key={team.id} style={{ marginBottom: '2rem' }}>
          <h2>{team.name} ({team.format})</h2>
          {team.captain && <p>Captain: {team.captain}</p>}
          <ul>
            {(team.players as any)?.map((p: any, i: number) => (
              <li key={i}><a href={`/players/${encodeURIComponent(p.name)}`}>{p.name}</a></li>
            ))}
          </ul>
        </div>
      ))}
    </main>
  )
}