'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Row = {
  player_id: number
  name: string
  team: string
  format: string
  games: number
  goals: number
  assists: number
  saves: number
  shots: number
  score: number
  mvps: number
  bpm: number
  avgSpeed: number
  demosInflicted: number
  demosTaken: number
  shPct: number
  demoRatio: number
}

type SortKey = keyof Row

export default function Stats() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('All')
  const [sortKey, setSortKey] = useState<SortKey>('goals')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    async function load() {
      const { data: full } = await supabase
        .from('match_player_stats')
        .select('player_id, goals, assists, saves, shots, score, mvp, bpm, avg_speed, demos_inflicted, demos_taken, players ( name, teams ( name, format ) )')

      const byPlayer: Record<number, Row> = {}

      full?.forEach((s: any) => {
        const pid = s.player_id
        if (!byPlayer[pid]) {
          byPlayer[pid] = {
            player_id: pid,
            name: s.players?.name ?? 'Unknown',
            team: s.players?.teams?.name ?? '',
            format: s.players?.teams?.format ?? '',
            games: 0, goals: 0, assists: 0, saves: 0, shots: 0, score: 0, mvps: 0,
            bpm: 0, avgSpeed: 0, demosInflicted: 0, demosTaken: 0, shPct: 0, demoRatio: 0,
          }
        }
        const r = byPlayer[pid]
        r.games += 1
        r.goals += s.goals ?? 0
        r.assists += s.assists ?? 0
        r.saves += s.saves ?? 0
        r.shots += s.shots ?? 0
        r.score += s.score ?? 0
        r.mvps += s.mvp ? 1 : 0
        r.bpm += s.bpm ?? 0
        r.avgSpeed += s.avg_speed ?? 0
        r.demosInflicted += s.demos_inflicted ?? 0
        r.demosTaken += s.demos_taken ?? 0
      })

      Object.values(byPlayer).forEach((r) => {
        r.bpm = r.games ? Math.round(r.bpm / r.games) : 0
        r.avgSpeed = r.games ? Math.round(r.avgSpeed / r.games) : 0
        r.shPct = r.shots ? Math.round((r.goals / r.shots) * 1000) / 10 : 0
        r.demoRatio = r.demosTaken > 0
          ? Math.round((r.demosInflicted / r.demosTaken) * 100) / 100
          : r.demosInflicted
      })

      setRows(Object.values(byPlayer))
      setLoading(false)
    }
    load()
  }, [])

  const teams = ['All', ...Array.from(new Set(rows.map((r) => r.team))).filter(Boolean)]

  const filtered = rows
    .filter((r) => teamFilter === 'All' || r.team === teamFilter)
    .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      const cmp = typeof av === 'string' ? String(av).localeCompare(String(bv)) : (av as number) - (bv as number)
      return sortDir === 'asc' ? cmp : -cmp
    })

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: 'name', label: 'Player' },
    { key: 'team', label: 'Team' },
    { key: 'games', label: 'GP' },
    { key: 'goals', label: 'G' },
    { key: 'assists', label: 'A' },
    { key: 'saves', label: 'SV' },
    { key: 'shots', label: 'SH' },
    { key: 'shPct', label: 'SH%' },
    { key: 'score', label: 'Score' },
    { key: 'mvps', label: 'MVP' },
    { key: 'bpm', label: 'BPM' },
    { key: 'avgSpeed', label: 'Speed' },
    { key: 'demoRatio', label: 'Demo Ratio' },
  ]

  return (
    <main className="px-8 py-16 max-w-7xl mx-auto">
      <h1 className="text-6xl font-black tracking-tight mb-2">Stats & <span style={{ color: '#AF69EE' }}>Medals</span></h1>
      <p className="text-neutral-500 mb-8">Every stat, every game, fully sortable</p>

      <div className="flex flex-wrap gap-4 mb-8">
        <input
          placeholder="Search player..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#1b1b1b] border border-neutral-800 rounded-lg px-4 py-2 text-sm text-white placeholder-neutral-600"
        />
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="bg-[#1b1b1b] border border-neutral-800 rounded-lg px-4 py-2 text-sm text-white"
        >
          {teams.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-neutral-500">Loading stats...</p>}
      {!loading && filtered.length === 0 && <p className="text-neutral-500">No players match.</p>}

      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1b1b1b] text-neutral-400 text-xs uppercase tracking-wide">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-4 py-3 text-left cursor-pointer hover:text-white select-none whitespace-nowrap"
                  >
                    {col.label} {sortKey === col.key && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.player_id} className="border-t border-neutral-800 hover:bg-[#161616]">
                  <td className="px-4 py-3">
                    <a href={`/players/${encodeURIComponent(r.name)}`} className="font-semibold text-white hover:underline">
                      {r.name}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{r.team}</td>
                  <td className="px-4 py-3">{r.games}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: '#AF69EE' }}>{r.goals}</td>
                  <td className="px-4 py-3">{r.assists}</td>
                  <td className="px-4 py-3">{r.saves}</td>
                  <td className="px-4 py-3">{r.shots}</td>
                  <td className="px-4 py-3">{r.shPct}%</td>
                  <td className="px-4 py-3">{r.score}</td>
                  <td className="px-4 py-3">{r.mvps}</td>
                  <td className="px-4 py-3">{r.bpm}</td>
                  <td className="px-4 py-3">{r.avgSpeed}</td>
                  <td className="px-4 py-3">{r.demoRatio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}