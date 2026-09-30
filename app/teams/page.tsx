/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/static-components */
import { supabase } from '@/lib/supabase'
import { teamHref } from '@/lib/teamRoutes'
import { brandingForTeam } from '@/lib/teamBranding'
import { partitionTeams } from '@/lib/teamLifecycle'
export const dynamic = 'force-dynamic'

export default async function Teams() {
  const { data: teams, error } = await supabase
    .from('teams')
    .select(`
      id,
      name,
      format,
      captain,
      display_name,
      short_name,
      slug,
      primary_color,
      secondary_color,
      logo_url,
      wordmark_style,
      active,
      brand_metadata,
      players ( name, status )
    `)
    .order('name')

  const { current } = partitionTeams(teams ?? [])
  const teams3v3 = current.filter((team) => team.format === '3v3')
  const teams2v2 = current.filter((team) => team.format === '2v2')

  function TeamGrid({ list }: { list: typeof teams3v3 }) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {list.length === 0 && <div className="col-span-full rounded-xl border border-neutral-800 bg-[#111] p-5 text-sm text-neutral-500">No teams are registered in this format yet.</div>}
        {list.map((team) => {
          const brand = brandingForTeam(team)
          return (
          <div
            key={team.id}
            id={team.name}
            style={{ borderTopColor: brand.secondaryColor, backgroundImage: `linear-gradient(135deg, ${brand.primaryColor}18, transparent 52%)` }}
            className="rounded-xl border border-neutral-800 border-t-4 bg-[#111] p-6 hover:-translate-y-0.5 hover:bg-neutral-900 transition-all"
          >
            <div className="flex items-baseline justify-between mb-1">
<h2 className="text-2xl font-bold">
                <a href={teamHref(team)} className="hover:underline">{brand.name}</a>
              </h2>              <span className="text-xs uppercase tracking-wide text-neutral-400">{team.format}</span>
            </div>
            {team.captain && <p className="text-sm text-neutral-400 mb-4">Captain: {team.captain}</p>}
            <ul className="space-y-1">
              {(team.players as any)?.filter((p: any) => !p.status || p.status === 'active').map((p: any, i: number) => (
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
            {!(team.players as any)?.filter((player: any) => !player.status || player.status === 'active').length ? <p className="mt-4 text-sm text-neutral-500">Roster coming soon.</p> : null}
          </div>
        )})}
      </div>
    )
  }

  return (
    <main className="px-4 py-10 md:px-8 md:py-14 max-w-6xl mx-auto">
      <div className="mb-10 rounded-3xl border border-neutral-800 bg-gradient-to-br from-[#171717] to-[#0d0d0d] p-6 md:p-9"><div className="text-xs font-bold uppercase tracking-[.22em] text-purple-400">Current competitive squads</div><h1 className="mt-2 text-4xl font-bold md:text-6xl">Our <span style={{ color: '#AF69EE' }}>Teams</span></h1><p className="mt-2 text-neutral-400">Meet the active squads representing Flop Reset. Retired identities remain permanently available in <a href="/history" className="text-purple-300 hover:underline">History</a>.</p></div>
      {error && <div className="rounded-xl border border-red-900 bg-red-950/20 p-4 text-red-300">Something went wrong while loading the teams. Please try again shortly.</div>}

      <h2 className="text-xl font-semibold text-neutral-300 mb-4 border-b border-neutral-800 pb-2">3v3</h2>
      <TeamGrid list={teams3v3} />

      <h2 className="text-xl font-semibold text-neutral-300 mb-4 border-b border-neutral-800 pb-2">2v2</h2>
      <TeamGrid list={teams2v2} />
    </main>
  )
}
