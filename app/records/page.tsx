import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

type Row = {
  name: string; team: string; games: number
  goals: number; assists: number; saves: number; shots: number; score: number
}

function topN(rows: Row[], key: keyof Row, n: number) {
  const sorted = [...rows].filter((r) => r[key] as number > 0).sort((a, b) => (b[key] as number) - (a[key] as number))
  const values = Array.from(new Set(sorted.map((r) => r[key]))).slice(0, n)
  return values.map((v) => ({ value: v as number, holders: sorted.filter((r) => r[key] === v) }))
}

const MEDALS = ['🥇', '🥈', '🥉']

function RecordCard({ emoji, title, entries }: { emoji: string; title: string; entries: { value: number; holders: Row[] }[] }) {
  if (!entries.length) return (
    <div className="rounded-xl bg-[#1b1b1b] border border-neutral-800 p-5">
      <h4 className="font-bold text-white mb-2">{emoji} {title}</h4>
      <p className="text-neutral-600 text-sm">No data yet.</p>
    </div>
  )
  return (
    <div className="rounded-xl bg-[#1b1b1b] border border-neutral-800 p-5">
      <h4 className="font-bold text-white mb-3">{emoji} {title}</h4>
      <div className="space-y-2">
        {entries.map((e, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-lg">{MEDALS[i]}</span>
            <div className="flex-1">
              {e.holders.map((h, j) => (
                <div key={j} className="text-sm">
                  <a href={`/players/${encodeURIComponent(h.name)}`} className="font-semibold text-white hover:underline">{h.name}</a>
                  <span className="text-neutral-500 ml-1">({h.team})</span>
                </div>
              ))}
            </div>
            <span className="font-mono font-bold" style={{ color: '#AF69EE' }}>{e.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function Records() {
  const { data: matchStats } = await supabase
    .from('match_player_stats')
    .select('goals, assists, saves, shots, score, players ( name, teams ( name ) )')

  const matchRows: Row[] = (matchStats ?? []).map((s: any) => ({
    name: s.players?.name ?? 'Unknown',
    team: s.players?.teams?.name ?? '',
    games: 1,
    goals: s.goals ?? 0,
    assists: s.assists ?? 0,
    saves: s.saves ?? 0,
    shots: s.shots ?? 0,
    score: s.score ?? 0,
  }))

  const seasonByPlayer: Record<string, Row> = {}
  matchRows.forEach((r) => {
    const key = r.name + '|' + r.team
    if (!seasonByPlayer[key]) seasonByPlayer[key] = { ...r, games: 0, goals: 0, assists: 0, saves: 0, shots: 0, score: 0 }
    const s = seasonByPlayer[key]
    s.games += 1
    s.goals += r.goals
    s.assists += r.assists
    s.saves += r.saves
    s.shots += r.shots
    s.score += r.score
  })
  const seasonRows = Object.values(seasonByPlayer)

  const matchRecords = [
    { emoji: '🥅', title: 'Most Goals (Single Game)', key: 'goals' as const },
    { emoji: '🎯', title: 'Most Assists (Single Game)', key: 'assists' as const },
    { emoji: '🧤', title: 'Most Saves (Single Game)', key: 'saves' as const },
    { emoji: '💥', title: 'Most Shots (Single Game)', key: 'shots' as const },
    { emoji: '💰', title: 'Highest Score (Single Game)', key: 'score' as const },
  ]

  const seasonRecords = [
    { emoji: '🏆', title: 'Most Goals (Season)', key: 'goals' as const },
    { emoji: '🎯', title: 'Most Assists (Season)', key: 'assists' as const },
    { emoji: '🧤', title: 'Most Saves (Season)', key: 'saves' as const },
    { emoji: '💰', title: 'Most Total Score (Season)', key: 'score' as const },
  ]

  return (
    <main className="px-8 py-16 max-w-7xl mx-auto">
      <h1 className="text-6xl font-black tracking-tight mb-2">League <span style={{ color: '#AF69EE' }}>Records</span></h1>
      <p className="text-neutral-500 mb-12">The best individual performances, ever</p>

      <h2 className="text-2xl font-bold mb-6">Single-Match Records</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
        {matchRecords.map((r) => (
          <RecordCard key={r.key} emoji={r.emoji} title={r.title} entries={topN(matchRows, r.key, 3)} />
        ))}
      </div>

      <h2 className="text-2xl font-bold mb-6">Season Records</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {seasonRecords.map((r) => (
          <RecordCard key={r.key} emoji={r.emoji} title={r.title} entries={topN(seasonRows, r.key, 3)} />
        ))}
      </div>
    </main>
  )
}