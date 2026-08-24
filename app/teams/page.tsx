/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/static-components */
import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

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
        {list.length === 0 && <div className="col-span-full rounded-xl border border-neutral-800 bg-[#111] p-5 text-sm text-neutral-500">No teams are registered in this format yet.</div>}
        {list.map((team) => (
          <div
            key={team.id}
            id={team.name}
            style={{ borderTopColor: colors[team.name] ?? '#666' }}
            className="rounded-xl border border-neutral-800 border-t-4 bg-[#111] p-6 hover:-translate-y-0.5 hover:bg-neutral-900 transition-all"
          >
            <div className="flex items-baseline justify-between mb-1">
<h2 className="text-2xl font-bold">
                <a href={`/teams/${encodeURIComponent(team.name)}`} className="hover:underline">{team.name}</a>
              </h2>              <span className="text-xs uppercase tracking-wide text-neutral-400">{team.format}</span>
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
    <main className="px-4 py-10 md:px-8 md:py-14 max-w-6xl mx-auto">
      <div className="mb-10 rounded-3xl border border-neutral-800 bg-gradient-to-br from-[#171717] to-[#0d0d0d] p-6 md:p-9"><div className="text-xs font-bold uppercase tracking-[.22em] text-purple-400">Competitive squads</div><h1 className="mt-2 text-4xl font-bold md:text-6xl">Our <span style={{ color: '#AF69EE' }}>Teams</span></h1><p className="mt-2 text-neutral-400">Meet the players representing Flop Reset in each recorded format.</p></div>
      {error && <p>Error: {error.message}</p>}

      <h2 className="text-xl font-semibold text-neutral-300 mb-4 border-b border-neutral-800 pb-2">3v3</h2>
      <TeamGrid list={teams3v3} />

      <h2 className="text-xl font-semibold text-neutral-300 mb-4 border-b border-neutral-800 pb-2">2v2</h2>
      <TeamGrid list={teams2v2} />
    </main>
  )
}
