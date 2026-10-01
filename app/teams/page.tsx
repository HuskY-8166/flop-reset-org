/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/static-components */
import { supabase } from '@/lib/supabase'
import { teamHref } from '@/lib/teamRoutes'
import { brandingForTeam } from '@/lib/teamBranding'
import { partitionTeams } from '@/lib/teamLifecycle'
import { buildCurrentRosterContexts } from '@/lib/currentRosters'
export const dynamic = 'force-dynamic'

export default async function Teams() {
  const [teamResult, seasonResult, competitionResult, entryResult, rosterResult] = await Promise.all([
    supabase.from('teams').select(`
      id,
      name,
      format,
      display_name,
      short_name,
      slug,
      primary_color,
      secondary_color,
      logo_url,
      wordmark_style,
      active,
      brand_metadata
    `).order('name'),
    supabase.from('public_competition_seasons').select('season_id, status, season_year, starts_at'),
    supabase.from('competitions').select('id, season_id, format, status, current_stage, start_date'),
    supabase.from('public_competition_entries').select('entry_id, competition_id, fr_team_id, registration_status, status'),
    supabase.from('public_competition_roster_members').select('roster_member_id, entry_id, display_name_snapshot, role, is_current, status, league_player_slug, league_player_display_name'),
  ])

  const teams = teamResult.data ?? []
  const error = teamResult.error ?? seasonResult.error ?? competitionResult.error ?? entryResult.error ?? rosterResult.error
  const { current } = partitionTeams(teams ?? [])
  const currentRosters = buildCurrentRosterContexts({
    teams: current,
    seasons: seasonResult.data ?? [],
    competitions: competitionResult.data ?? [],
    entries: entryResult.data ?? [],
    members: rosterResult.data ?? [],
  })
  const teams3v3 = current.filter((team) => team.format === '3v3')
  const teams2v2 = current.filter((team) => team.format === '2v2')

  function TeamGrid({ list }: { list: typeof teams3v3 }) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {list.length === 0 && <div className="col-span-full rounded-xl border border-neutral-800 bg-[#111] p-5 text-sm text-neutral-500">No teams are registered in this format yet.</div>}
        {list.map((team) => {
          const brand = brandingForTeam(team)
          const roster = currentRosters.get(Number(team.id))?.members ?? []
          const captain = roster.find((member) => member.role === 'captain')
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
            {captain && <p className="text-sm text-neutral-400 mb-4">Captain: {captain.display_name_snapshot}</p>}
            <ul className="space-y-1">
              {roster.map((member: any) => (
                <li key={member.roster_member_id ?? `${member.entry_id}-${member.display_name_snapshot}`} className="flex items-center justify-between gap-3">
                  {member.league_player_slug ? <a href={`/league/players/${member.league_player_slug}`} className="text-neutral-200 hover:text-white hover:underline">{member.display_name_snapshot}</a> : <span className="text-neutral-200">{member.display_name_snapshot}</span>}
                  {member.role && member.role !== 'player' ? <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">{member.role}</span> : null}
                </li>
              ))}
            </ul>
            {!roster.length ? <p className="mt-4 text-sm text-neutral-500">Roster coming soon.</p> : null}
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
