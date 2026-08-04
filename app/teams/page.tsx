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

  const colors: Record<string, string> = {
    Fracture: '#E4A0F7',
    Frantic: '#AF69EE',
    Frameshift: '#8F00FF',
  }              

  const teams3v3 = teams?.filter((t) => t.format === '3v3') ?? []
  const teams2v2 = teams?.filter((t) => t.format === '2v2') ?? []

  function TeamGrid({ list }: { list: typeof teams3v3 }) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {list.map((team) => (
          <div
            key={team.id}
            id={team.name}
            style={{ borderTopColor: colors[team.name] ?? '#666' }}
            className="rounded-xl border-t-4 bg-neutral-900 p-6 hover:bg-neutral-800 transition-colors"
          >
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-2xl font-bold">{team.name}</h2>
              <span className="text-xs uppercase tracking-wide text-neutral-400">{team.format}</span>
            </div>
            {team.captain && <p className="text-sm text-neutral-400 mb-4">Captain: {team.captain}</p>}
            <ul className="space-y-1">
              {(team.players as any)?.map((p: any, i: number) => (
                <li key={i}>
                  <a
                    href={`/players/${encodeURIComponent(p.name)}`}
                    className="text-neutral-200 hover:text-white hover:underline"
                  >
                    {p.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )
  }

  return (
    <main className="px-8 py-12 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">Our <span style={{ color: '#AF69EE' }}>Teams</span></h1>
      <p className="text-neutral-400 mb-10">Meet the squads competing under Flop Reset</p>
      {error && <p>Error: {error.message}</p>}

      <h2 className="text-xl font-semibold text-neutral-300 mb-4 border-b border-neutral-800 pb-2">3v3</h2>
      <TeamGrid list={teams3v3} />

      <h2 className="text-xl font-semibold text-neutral-300 mb-4 border-b border-neutral-800 pb-2">2v2</h2>
      <TeamGrid list={teams2v2} />
    </main>
  )
}