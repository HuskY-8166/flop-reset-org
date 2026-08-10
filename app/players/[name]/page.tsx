import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function PlayerProfile({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const playerName = decodeURIComponent(name)

  const { data: playerRows } = await supabase
    .from('players')
    .select('player_id, name, team_id, teams ( name, format )')
    .eq('name', playerName)

  const playerIds = playerRows?.map((p) => p.player_id) ?? []

  const { data: stats } = await supabase
    .from('match_player_stats')
    .select('goals, assists, saves, shots, score, mvp, match_id, matches ( match_date, opponent_name, flop_reset_score, opponent_score, series_id )')
    .in('player_id', playerIds)
    .order('match_id', { ascending: true })

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

  // Records held: check if this player is the org-wide leader in any single-match or season stat
  const { data: allStats } = await supabase
    .from('match_player_stats')
    .select('goals, assists, saves, shots, player_id, players ( name )')

  const recordCategories: { key: 'goals' | 'assists' | 'saves' | 'shots'; label: string; emoji: string }[] = [
    { key: 'goals', label: 'Most Goals (Single Game)', emoji: '🥅' },
    { key: 'assists', label: 'Most Assists (Single Game)', emoji: '🎯' },
    { key: 'saves', label: 'Most Saves (Single Game)', emoji: '🧤' },
    { key: 'shots', label: 'Most Shots (Single Game)', emoji: '💥' },
  ]

  const recordsHeld = recordCategories.filter((cat) => {
    const maxValue = Math.max(...(allStats ?? []).map((s: any) => s[cat.key] ?? 0))
    return maxValue > 0 && (allStats ?? []).some((s: any) => s[cat.key] === maxValue && s.players?.name === playerName)
  })

  // Season totals per player, for season-record comparison
  const seasonTotals: Record<string, { goals: number; assists: number; saves: number; shots: number }> = {}
  allStats?.forEach((s: any) => {
    const n = s.players?.name
    if (!n) return
    if (!seasonTotals[n]) seasonTotals[n] = { goals: 0, assists: 0, saves: 0, shots: 0 }
    seasonTotals[n].goals += s.goals ?? 0
    seasonTotals[n].assists += s.assists ?? 0
    seasonTotals[n].saves += s.saves ?? 0
    seasonTotals[n].shots += s.shots ?? 0
  })
  const seasonRecordCategories: { key: 'goals' | 'assists' | 'saves' | 'shots'; label: string; emoji: string }[] = [
    { key: 'goals', label: 'Most Goals (Season)', emoji: '🏆' },
    { key: 'assists', label: 'Most Assists (Season)', emoji: '🎯' },
    { key: 'saves', label: 'Most Saves (Season)', emoji: '🧤' },
    { key: 'shots', label: 'Most Shots (Season)', emoji: '💥' },
  ]
  const seasonRecordsHeld = seasonRecordCategories.filter((cat) => {
    const maxValue = Math.max(...Object.values(seasonTotals).map((t) => t[cat.key]))
    return maxValue > 0 && seasonTotals[playerName]?.[cat.key] === maxValue
  })

  // Trend: last 3 MATCHES (series) vs season average goals per game
  const bySeries: Record<string, any[]> = {}
  stats?.forEach((s: any) => {
    const sid = s.matches?.series_id ?? 'unknown'
    bySeries[sid] = bySeries[sid] || []
    bySeries[sid].push(s)
  })
  const seriesIds = Object.keys(bySeries)
  const last3SeriesIds = seriesIds.slice(-3)
  const last3Games = last3SeriesIds.flatMap((sid) => bySeries[sid])
  const last3AvgGoals = last3Games.length ? last3Games.reduce((s, r) => s + (r.goals ?? 0), 0) / last3Games.length : 0
  const seasonAvgGoals = totals && totals.games ? totals.goals / totals.games : 0
  const trendDiff = last3AvgGoals - seasonAvgGoals
  const trend = trendDiff > 0.3 ? 'up' : trendDiff < -0.3 ? 'down' : 'steady'

  // Wins vs Losses split
  const wins = stats?.filter((s: any) => (s.matches?.flop_reset_score ?? 0) > (s.matches?.opponent_score ?? 0)) ?? []
  const losses = stats?.filter((s: any) => (s.matches?.flop_reset_score ?? 0) <= (s.matches?.opponent_score ?? 0)) ?? []
  const avg = (arr: any[], key: string) => (arr.length ? Math.round((arr.reduce((s, r) => s + (r[key] ?? 0), 0) / arr.length) * 10) / 10 : 0)

  return (
    <main className="px-8 py-16 max-w-5xl mx-auto">
      <h1 className="text-6xl font-black tracking-tight mb-1">{playerName}</h1>
      <p className="text-neutral-500 mb-10">
        {playerRows?.map((p) => `${(p.teams as any)?.name} (${(p.teams as any)?.format})`).join(' / ')}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-12">
        {[
          { label: 'Games', value: totals?.games ?? 0 },
          { label: 'Goals', value: totals?.goals ?? 0 },
          { label: 'Assists', value: totals?.assists ?? 0 },
          { label: 'Saves', value: totals?.saves ?? 0 },
          { label: 'Shots', value: totals?.shots ?? 0 },
          { label: 'MVPs', value: totals?.mvps ?? 0 },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-[#1b1b1b] border border-neutral-800 p-4 text-center">
            <div className="text-3xl font-black" style={{ color: '#AF69EE' }}>{stat.value}</div>
            <div className="text-xs text-neutral-500 uppercase tracking-wide mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {(recordsHeld.length > 0 || seasonRecordsHeld.length > 0) && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Records Held</h2>
          <div className="flex flex-wrap gap-2">
            {[...recordsHeld, ...seasonRecordsHeld].map((r) => (
              <span key={r.label} className="text-sm font-semibold px-3 py-1 rounded-full border border-purple-700 text-purple-300 bg-purple-950">
                {r.emoji} {r.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-12 rounded-xl bg-[#1b1b1b] border border-neutral-800 p-5">
        <h2 className="text-lg font-bold mb-2">Recent Form</h2>
        <p className="text-neutral-400">
          Last 3 matches ({last3Games.length} games) averaging <span className="text-white font-semibold">{last3AvgGoals.toFixed(1)}</span> goals/game,
          season average is <span className="text-white font-semibold">{seasonAvgGoals.toFixed(1)}</span> —{' '}
          {trend === 'up' && <span className="text-emerald-400 font-semibold">trending up ▲</span>}
          {trend === 'down' && <span className="text-red-400 font-semibold">trending down ▼</span>}
          {trend === 'steady' && <span className="text-neutral-400 font-semibold">steady —</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="rounded-xl bg-[#1b1b1b] border border-emerald-900 p-5">
          <h3 className="font-bold text-emerald-400 mb-3">In Wins ({wins.length})</h3>
          <div className="text-sm text-neutral-300 space-y-1">
            <div>Avg Goals: {avg(wins, 'goals')}</div>
            <div>Avg Assists: {avg(wins, 'assists')}</div>
            <div>Avg Saves: {avg(wins, 'saves')}</div>
          </div>
        </div>
        <div className="rounded-xl bg-[#1b1b1b] border border-red-900 p-5">
          <h3 className="font-bold text-red-400 mb-3">In Losses ({losses.length})</h3>
          <div className="text-sm text-neutral-300 space-y-1">
            <div>Avg Goals: {avg(losses, 'goals')}</div>
            <div>Avg Assists: {avg(losses, 'assists')}</div>
            <div>Avg Saves: {avg(losses, 'saves')}</div>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">Game Log</h2>
      <div className="space-y-2">
        {stats?.map((s: any, i) => (
          <div key={i} className="rounded-lg bg-[#1b1b1b] border border-neutral-800 p-4 flex justify-between items-center text-sm">
            <span className="text-neutral-400">
              {s.matches?.match_date} vs {s.matches?.opponent_name}
            </span>
            <span className="text-white font-semibold">
              {s.goals}G {s.assists}A {s.saves}S {s.mvp && <span className="text-purple-400 ml-2">MVP</span>}
            </span>
          </div>
        ))}
      </div>
    </main>
  )
}