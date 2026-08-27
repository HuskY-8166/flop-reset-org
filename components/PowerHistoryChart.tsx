'use client'

import { useMemo, useState } from 'react'
import type { RatingRoundPoint } from '@/lib/elo'

type Range = '3r' | '5r' | 'all' | '2w' | '4w'
const FLOP_NAMES = ['Flop Reset Frameshift', 'Flop Reset - Frantic', 'Flop Reset | Fracture']
const colors = ['#AF69EE', '#22c55e', '#38bdf8', '#f59e0b', '#f43f5e', '#a3e635', '#e879f9', '#fb7185']

export function PowerHistoryChart({ history, teams }: { history: Record<string, RatingRoundPoint[]>; teams: string[] }) {
  const defaults = FLOP_NAMES.filter((team) => history[team]?.length)
  const [selected, setSelected] = useState<string[]>(defaults.length ? defaults : teams.slice(0, 3))
  const [candidate, setCandidate] = useState('')
  const [range, setRange] = useState<Range>('all')
  const [axis, setAxis] = useState<'round' | 'date'>('round')

  const visibleHistory = useMemo(() => {
    const latestDate = Math.max(0, ...Object.values(history).flat().map((point) => new Date(`${point.date}T00:00:00Z`).getTime()).filter(Number.isFinite))
    return Object.fromEntries(selected.map((team) => {
      let points = history[team] ?? []
      if (range === '3r' || range === '5r') points = points.slice(-(range === '3r' ? 3 : 5))
      if (range === '2w' || range === '4w') {
        const days = range === '2w' ? 14 : 28
        points = points.filter((point) => latestDate - new Date(`${point.date}T00:00:00Z`).getTime() <= days * 86_400_000)
      }
      return [team, points]
    }))
  }, [history, range, selected])

  const allPoints = Object.values(visibleHistory).flat()
  const ratings = allPoints.map((point) => point.rating)
  const minRating = ratings.length ? Math.floor((Math.min(...ratings) - 30) / 25) * 25 : 1000
  const maxRating = ratings.length ? Math.ceil((Math.max(...ratings) + 30) / 25) * 25 : 2000
  const rounds = allPoints.map((point) => point.round)
  const minRound = rounds.length ? Math.min(...rounds) : 0
  const maxRound = rounds.length ? Math.max(...rounds) : 1
  const dates = allPoints.map((point) => new Date(`${point.date}T00:00:00Z`).getTime()).filter(Number.isFinite)
  const minDate = dates.length ? Math.min(...dates) : 0
  const maxDate = dates.length ? Math.max(...dates) : 1
  const width = 920
  const height = 320
  const insetX = 60
  const insetY = 34
  const xFor = (point: RatingRoundPoint) => axis === 'round'
    ? insetX + ((point.round - minRound) / Math.max(1, maxRound - minRound)) * (width - insetX * 2)
    : insetX + ((new Date(`${point.date}T00:00:00Z`).getTime() - minDate) / Math.max(1, maxDate - minDate)) * (width - insetX * 2)
  const yFor = (rating: number) => height - insetY - ((rating - minRating) / Math.max(1, maxRating - minRating)) * (height - insetY * 2)

  function addTeam() {
    if (candidate && !selected.includes(candidate)) setSelected((current) => [...current, candidate].slice(-6))
    setCandidate('')
  }

  return <section className="mt-12 min-w-0 rounded-3xl border border-neutral-800 bg-[#111] p-5 md:p-7"><div className="flex min-w-0 flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="text-xs font-black uppercase tracking-[.22em] text-purple-400">Historical strength</div><h2 className="mt-1 text-3xl font-black text-white">Power Over Time</h2><p className="mt-1 max-w-2xl text-sm text-neutral-500">Round points show rating after every completed round. Tap a point to inspect its opponents, results, and total round movement.</p></div><div className="flex gap-2"><button type="button" onClick={() => setAxis('round')} className={`rounded-full px-3 py-2 text-xs font-bold ${axis === 'round' ? 'bg-purple-700 text-white' : 'border border-neutral-700 text-neutral-400'}`}>Round</button><button type="button" onClick={() => setAxis('date')} className={`rounded-full px-3 py-2 text-xs font-bold ${axis === 'date' ? 'bg-purple-700 text-white' : 'border border-neutral-700 text-neutral-400'}`}>Date</button></div></div>
    <div className="mt-5 flex flex-wrap gap-2">{([['3r','Last 3 Rounds'],['5r','Last 5 Rounds'],['all','All Rounds'],['2w','Last 2 Weeks'],['4w','Last 4 Weeks']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setRange(value)} className={`rounded-full px-3 py-2 text-xs font-bold ${range === value ? 'bg-purple-700 text-white' : 'border border-neutral-700 text-neutral-400'}`}>{label}</button>)}</div>
    <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2"><select value={candidate} onChange={(event) => setCandidate(event.target.value)} className="min-h-10 max-w-full min-w-0 rounded-lg border border-neutral-700 bg-[#181818] px-3 text-sm text-white"><option value="">Add a team…</option>{teams.filter((team) => !selected.includes(team)).map((team) => <option key={team}>{team}</option>)}</select><button type="button" onClick={addTeam} disabled={!candidate} className="min-h-10 rounded-lg bg-purple-700 px-4 text-sm font-bold text-white disabled:opacity-40">Add</button>{selected.map((team,index) => <button key={team} type="button" onClick={() => setSelected((current) => current.filter((entry) => entry !== team))} className="max-w-full break-words rounded-full border px-3 py-2 text-left text-xs font-bold" style={{ borderColor: colors[index % colors.length], color: colors[index % colors.length] }}>{team} ×</button>)}</div>
    {allPoints.length ? <div className="mt-5 max-w-full min-w-0 overflow-x-auto rounded-2xl border border-neutral-800 bg-black/20 p-3"><svg viewBox={`0 0 ${width} ${height}`} className="h-[320px] min-w-[820px]" role="img" aria-label="Selected team power ratings over time">{[0,.25,.5,.75,1].map((fraction) => {const rating=minRating+(maxRating-minRating)*fraction;const y=yFor(rating);return <g key={fraction}><line x1={insetX} x2={width-insetX} y1={y} y2={y} stroke="rgba(255,255,255,.08)"/><text x="6" y={y+4} fill="#737373" fontSize="11">{Math.round(rating)}</text></g>})}{selected.map((team,index) => {const points=visibleHistory[team]??[];const path=points.map((point,pointIndex)=>`${pointIndex?'L':'M'} ${xFor(point)} ${yFor(point.rating)}`).join(' ');return <g key={team}><path d={path} fill="none" stroke={colors[index%colors.length]} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>{points.map((point) => <circle key={`${team}-${point.round}`} cx={xFor(point)} cy={yFor(point.rating)} r="8" fill="#0b0b0b" stroke={colors[index%colors.length]} strokeWidth="3"><title>{`${team} · ${point.date} · ${point.roundLabel} · ${Math.round(point.rating)} Elo · ${point.delta>=0?'+':''}${point.delta.toFixed(1)} · ${point.results.join(', ')} vs ${point.opponents.join(', ')}`}</title></circle>)}</g>})}</svg></div> : <div className="mt-5 rounded-2xl border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-500">No rating history matches this team and time selection.</div>}
  </section>
}
