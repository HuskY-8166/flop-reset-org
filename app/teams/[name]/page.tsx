/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const TEAM_COLORS: Record<string, string> = {
  Fracture: '#E4A0F7',
  Frantic: '#AF69EE',
  Frameshift: '#8F00FF',
}

export default async function TeamPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const teamName = decodeURIComponent(name)

  const { data: teamRows } = await supabase
    .from('teams')
    .select('id, name, format, captain, players ( player_id, name )')
    .eq('name', teamName)

  const { data: series } = await supabase
    .from('series')
    .select('series_id, opponent_name, series_date, teams ( name, format ), matches ( flop_reset_score, opponent_score )')
    .in('flop_reset_team_id', teamRows?.map((t) => t.id) ?? [])
    .order('series_date', { ascending: false })

  let seriesWon = 0, seriesLost = 0, gamesWon = 0, gamesLost = 0, goalsFor = 0, goalsAgainst = 0
  series?.forEach((s: any) => {
    const gw = s.matches?.filter((m: any) => m.flop_reset_score > m.opponent_score).length ?? 0
    const gl = (s.matches?.length ?? 0) - gw
    gamesWon += gw
    gamesLost += gl
    goalsFor += s.matches?.reduce((total: number, m: any) => total + Number(m.flop_reset_score ?? 0), 0) ?? 0
    goalsAgainst += s.matches?.reduce((total: number, m: any) => total + Number(m.opponent_score ?? 0), 0) ?? 0
    if (gw > gl) seriesWon++
    else if (gl > gw) seriesLost++
  })

  const color = TEAM_COLORS[teamName] ?? '#AF69EE'

  return (
    <main className="px-4 py-10 md:px-8 md:py-16 max-w-5xl mx-auto">
      <div className="rounded-2xl border-t-4 p-8 mb-10" style={{ borderColor: color, background: `linear-gradient(135deg, ${color}22, transparent)` }}>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-2">{teamName}</h1>
        <p className="text-neutral-400 mb-6">
          {teamRows?.map((t) => t.format).join(' / ')} · Flop Reset
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-3xl font-black" style={{ color }}>{seriesWon}-{seriesLost}</div>
            <div className="text-xs text-neutral-500 uppercase tracking-wide">Series Record</div>
          </div>
          <div><div className="text-3xl font-black" style={{ color }}>{series?.length ? (goalsFor / Math.max(1,gamesWon+gamesLost)).toFixed(2) : '—'}</div><div className="text-xs text-neutral-500 uppercase tracking-wide">Goals / Game</div></div>
          <div><div className="text-3xl font-black" style={{ color }}>{series?.length ? (goalsAgainst / Math.max(1,gamesWon+gamesLost)).toFixed(2) : '—'}</div><div className="text-xs text-neutral-500 uppercase tracking-wide">Allowed / Game</div></div>
          <div>
            <div className="text-3xl font-black" style={{ color }}>{gamesWon}-{gamesLost}</div>
            <div className="text-xs text-neutral-500 uppercase tracking-wide">Game Record</div>
          </div>
        </div>
      </div>

      <section className="mb-12"><h2 className="text-2xl font-bold mb-4">Recent Form</h2><div className="flex gap-2">{series?.slice(0,5).map((s:any) => { const wins=s.matches?.filter((m:any)=>m.flop_reset_score>m.opponent_score).length??0; const losses=s.matches?.filter((m:any)=>m.flop_reset_score<m.opponent_score).length??0; const won=wins>losses; return <span key={s.series_id} className={`flex h-10 w-10 items-center justify-center rounded-lg border font-black ${won ? 'border-emerald-900 bg-emerald-950 text-emerald-400' : 'border-red-900 bg-red-950 text-red-400'}`}>{won?'W':'L'}</span> })}{(!series || series.length===0) && <p className="text-sm text-neutral-500">No recorded series yet.</p>}</div></section>

      <h2 className="text-2xl font-bold mb-4">Roster</h2>
       <div className="flex flex-wrap gap-3 mb-12">
        {Array.from(
          new Map(
            (teamRows?.flatMap((t) => t.players as any[]) ?? []).map((p) => [p.name, p])
          ).values()
        ).map((p, i) => (
           <a
            key={i}
            href={`/players/${encodeURIComponent(p.name)}`}
            className="px-4 py-2 rounded-full border border-neutral-700 hover:border-purple-500 text-neutral-200 hover:text-white transition-colors"
           >
            {p.name}
          </a>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-2xl font-bold">Recent Series</h2><a href={`/records?format=${encodeURIComponent(teamRows?.[0]?.format ?? '')}`} className="text-sm text-purple-300 hover:underline">Explore records →</a></div>
      <div className="space-y-3">
        {(!series || series.length === 0) && <p className="text-neutral-500">No matches recorded yet.</p>}
        {series?.map((s: any) => {
          const gw = s.matches?.filter((m: any) => m.flop_reset_score > m.opponent_score).length ?? 0
          const gl = s.matches?.filter((m: any) => m.flop_reset_score < m.opponent_score).length ?? 0
          const won = gw > gl
          return (
            <a
              key={s.series_id}
              href={`/matches/${s.series_id}`}
              className={`block no-underline rounded-xl bg-[#1b1b1b] border-l-4 p-4 hover:bg-neutral-800 transition-colors ${won ? 'border-emerald-500' : 'border-red-500'}`}
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold text-white">vs {s.opponent_name}</span>
                <span className={`text-sm font-bold ${won ? 'text-emerald-400' : 'text-red-400'}`}>
                  {won ? 'W' : 'L'} {gw}-{gl}
                </span>
              </div>
              <div className="text-neutral-500 text-xs">{s.series_date}</div>
            </a>
          )
        })}
      </div>
    </main>
  )
}
