import { supabase } from '@/lib/supabase'
import { calculateEloWithHistory } from '@/lib/elo'

const TEAM_COLORS: Record<string, string> = {
  Fracture: '#E4A0F7',
  Frantic: '#AF69EE',
  Frameshift: '#8F00FF',
}

export default async function Home() {
  const { data: competitions } = await supabase.from('competitions').select('*')

  const { data: featuredMatch } = await supabase
    .from('scheduled_matches')
    .select('opponent_name, match_date, match_time, teams ( name, format )')
    .eq('status', 'scheduled')
    .order('match_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: upcoming } = await supabase
    .from('scheduled_matches')
    .select('scheduled_id, opponent_name, match_date, match_time, teams ( name, format )')
    .eq('status', 'scheduled')
    .order('match_date', { ascending: true })
    .limit(3)

  const { data: recentSeries } = await supabase
    .from('series')
    .select('series_id, opponent_name, series_date, teams ( name, format ), matches ( flop_reset_score, opponent_score, match_id )')
    .order('series_date', { ascending: false })
    .limit(3)

  const matchIds = recentSeries?.flatMap((s: any) => s.matches?.map((m: any) => m.match_id) ?? []) ?? []
  const { data: mvpStats } = matchIds.length
    ? await supabase
        .from('match_player_stats')
        .select('match_id, mvp, players ( name )')
        .in('match_id', matchIds)
        .eq('mvp', true)
    : { data: [] }

  const { data: leagueMatches3v3 } = await supabase
    .from('league_matches')
    .select('round, tier, team_a, team_b, score_a, score_b, status, match_date')
    .eq('format', '3v3')

  const FLOP_TEAMS = ['Flop Reset Frameshift', 'Flop Reset - Frantic', 'Flop Reset | Fracture']
  const eloData = leagueMatches3v3 ? calculateEloWithHistory(leagueMatches3v3 as any) : null
  const flopRankings = eloData
    ? eloData.teamSummaries.filter((t) => FLOP_TEAMS.includes(t.team))
    : []

  const { data: allSeries } = await supabase
    .from('series')
    .select('teams ( name ), matches ( flop_reset_score, opponent_score )')

  let totalWins = 0, totalLosses = 0
  allSeries?.forEach((s: any) => {
    const gamesWon = s.matches?.filter((m: any) => m.flop_reset_score > m.opponent_score).length ?? 0
    const gamesLost = (s.matches?.length ?? 0) - gamesWon
    if (gamesWon > gamesLost) totalWins++
    else totalLosses++
  })

  function moveArrow(move: number) {
    if (move > 0) return <span className="text-emerald-400 text-xs">▲{move}</span>
    if (move < 0) return <span className="text-red-400 text-xs">▼{Math.abs(move)}</span>
    return <span className="text-neutral-500 text-xs">—</span>
  }

  return (
    <main className="px-8 py-16 max-w-7xl mx-auto">
      {featuredMatch && (
        <div className="mb-16 rounded-2xl border-2 p-10 text-center" style={{ borderColor: '#8F00FF', background: 'linear-gradient(135deg, rgba(143,0,255,0.15), rgba(0,0,0,0))' }}>
          <div className="text-xs uppercase tracking-widest text-purple-400 font-bold mb-6">Match of the Week</div>
          <div className="flex items-center justify-center gap-8 mb-6">
            <span className="text-4xl font-black text-white">{(featuredMatch.teams as any)?.name}</span>
            <span className="text-2xl font-bold text-neutral-500">VS</span>
            <span className="text-4xl font-black text-neutral-300">{featuredMatch.opponent_name ?? 'TBD'}</span>
          </div>
          <p className="text-neutral-400 mb-1">{featuredMatch.match_date} {featuredMatch.match_time && `• ${featuredMatch.match_time}`}</p>
          <p className="text-neutral-600 text-sm">{(featuredMatch.teams as any)?.format}</p>
        </div>
      )}

      {/* Hero */}
      <div className="mb-20">
        <h1 className="text-7xl font-black tracking-tight mb-2 text-white">
          FLOP <span style={{ color: '#AF69EE' }}>RESET</span>
        </h1>
        <p className="text-neutral-500 text-lg mb-6">Competing across The Rivalry — 3v3 · 2v2</p>
        <div className="flex gap-6 items-center">
          <div>
            <span className="text-3xl font-bold text-white">{totalWins}-{totalLosses}</span>
            <span className="text-neutral-500 text-sm ml-2">series record, all teams</span>
          </div>
          <div className="flex gap-2">
            {Object.entries(TEAM_COLORS).map(([name, color]) => (
              <a
                key={name}
                href={`/teams#${name}`}
                style={{ borderColor: color }}
                className="text-sm px-3 py-1 rounded-full border font-semibold text-neutral-300 hover:bg-neutral-900 transition-colors"
              >
                {name}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Three-column dashboard row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-16">
        {/* Upcoming */}
        <div className="rounded-xl bg-[#1b1b1b] border border-neutral-800 p-6">
          <h2 className="text-lg font-bold mb-4 text-white">Upcoming</h2>
          {(!upcoming || upcoming.length === 0) && <p className="text-neutral-500 text-sm">Nothing scheduled.</p>}
          <div className="space-y-4">
            {upcoming?.map((m) => (
              <div key={m.scheduled_id} className="border-t border-neutral-800 pt-4 first:border-t-0 first:pt-0">
                <div className="font-semibold text-sm text-white">
                  {(m.teams as any)?.name} vs {m.opponent_name ?? 'TBD'}
                </div>
                <div className="text-neutral-500 text-xs mt-1">{m.match_date} {m.match_time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Results */}
        <div className="rounded-xl bg-[#1b1b1b] border border-neutral-800 p-6">
          <h2 className="text-lg font-bold mb-4 text-white">Recent Results</h2>
          {(!recentSeries || recentSeries.length === 0) && <p className="text-neutral-500 text-sm">No results yet.</p>}
          <div className="space-y-4">
            {recentSeries?.map((s: any) => {
              const gamesWon = s.matches?.filter((m: any) => m.flop_reset_score > m.opponent_score).length ?? 0
              const gamesLost = (s.matches?.length ?? 0) - gamesWon
              const won = gamesWon > gamesLost
              const matchIdsForSeries = s.matches?.map((m: any) => m.match_id) ?? []
              const mvp = mvpStats?.find((ms: any) => matchIdsForSeries.includes(ms.match_id))
              return (
                <div key={s.series_id} className="border-t border-neutral-800 pt-4 first:border-t-0 first:pt-0">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-white">{s.teams?.name} vs {s.opponent_name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${won ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
                      {won ? 'W' : 'L'} {gamesWon}-{gamesLost}
                    </span>
                  </div>
                  <div className="text-neutral-500 text-xs mt-1">
                    {s.series_date}{mvp && ` · MVP: ${(mvp.players as any)?.name}`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Power Rankings Snapshot */}
        <div className="rounded-xl bg-[#1b1b1b] border border-neutral-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">Power Rankings</h2>
            <a href="/power-rankings" className="text-xs text-purple-400 hover:underline">View all →</a>
          </div>
          {flopRankings.length === 0 && <p className="text-neutral-500 text-sm">No ranking data yet.</p>}
          <div className="space-y-4">
            {flopRankings.map((t) => (
              <div key={t.team} className="border-t border-neutral-800 pt-4 first:border-t-0 first:pt-0">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm text-white">
                    {t.team.replace('Flop Reset ', '').replace(' | ', '').replace(' - ', '')}
                  </span>
                  {moveArrow(t.rankMove)}
                </div>
                <div className="text-neutral-500 text-xs mt-1">
                  {t.tier} · #{t.overallRank} overall · {Math.round(t.rating)} Elo
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Competitions, secondary */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Competitions</h2>
        <div className="flex flex-wrap gap-3">
          {competitions?.map((comp) => (
            <div key={comp.id} className="text-sm text-neutral-400 bg-[#1b1b1b] border border-neutral-800 rounded-full px-4 py-1 hover:border-purple-700 transition-colors">
              {comp.name} — {comp.host}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}