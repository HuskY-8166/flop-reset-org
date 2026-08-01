import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: competitions, error } = await supabase
    .from('competitions')
    .select('*')

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Flop Reset</h1>
      <h2>Competitions</h2>
      {error && <p>Error loading data: {error.message}</p>}
      <ul>
        {competitions?.map((comp) => (
          <li key={comp.id}>
            <strong>{comp.name}</strong> — hosted by {comp.host} ({comp.format})
          </li>
        ))}
      </ul>
    </main>
  )
}