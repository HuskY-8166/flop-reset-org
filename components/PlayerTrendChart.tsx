'use client'

import { useMemo, useState } from 'react'

export type TrendPoint = {
  id: number
  seriesId: number
  gameNumber: number | null
  date: string
  opponent: string
  competition: string
  circuit: string
  format: string
  result: string
  goals: number
  assists: number
  saves: number
  shots: number
  score: number
  shootingPct: number | null
  bpm: number | null
  avgSpeed: number | null
}

type Metric = 'goals' | 'assists' | 'saves' | 'shots' | 'score' | 'shootingPct' | 'bpm' | 'avgSpeed'
type WindowMode = 1 | 3 | 5

const labels: Record<Metric, string> = {
  goals: 'Goals',
  assists: 'Assists',
  saves: 'Saves',
  shots: 'Shots',
  score: 'Score',
  shootingPct: 'Shooting %',
  bpm: 'BPM',
  avgSpeed: 'Avg Speed',
}

function formatValue(metric: Metric, value: number | null) {
  if (value === null) return 'Unavailable'
  if (metric === 'shootingPct') return `${value.toFixed(1)}%`
  if (metric === 'bpm') return value.toFixed(1)
  if (metric === 'avgSpeed' || metric === 'score') return Math.round(value).toLocaleString()
  return value.toFixed(value % 1 ? 2 : 0)
}

function metricValue(point: TrendPoint, metric: Metric) {
  return point[metric]
}

export function PlayerTrendChart({ points }: { points: TrendPoint[] }) {
  const [metric, setMetric] = useState<Metric>('goals')
  const [windowMode, setWindowMode] = useState<WindowMode>(1)
  const [competition, setCompetition] = useState('All Competitions')
  const [format, setFormat] = useState('All Formats')

  const competitions = useMemo(() => [...new Set(points.map((point) => point.competition).filter(Boolean))], [points])
  const formats = useMemo(() => [...new Set(points.map((point) => point.format).filter(Boolean))], [points])
  const filtered = useMemo(() => points.filter((point) =>
    (competition === 'All Competitions' || point.competition === competition) &&
    (format === 'All Formats' || point.format === format)
  ), [points, competition, format])

  const values = useMemo(() => filtered.map((point, index) => {
    const start = Math.max(0, index - windowMode + 1)
    const sample = filtered.slice(start, index + 1).map((entry) => metricValue(entry, metric))
    if (sample.length < windowMode || sample.some((value) => value === null)) return null
    return sample.reduce<number>((total, value) => total + Number(value), 0) / sample.length
  }), [filtered, metric, windowMode])

  if (!points.length) return null

  const width = Math.max(760, filtered.length * 58)
  const height = 280
  const insetX = 42
  const insetY = 34
  const available = values.filter((value): value is number => value !== null)
  const max = Math.max(1, ...available)
  const coordinates = values.map((value, index) => ({
    value,
    x: filtered.length === 1 ? width / 2 : insetX + (index / Math.max(1, filtered.length - 1)) * (width - insetX * 2),
    y: value === null ? null : height - insetY - (value / max) * (height - insetY * 2),
  }))
  const segments: string[] = []
  let segment = ''
  coordinates.forEach((point) => {
    if (point.y === null) {
      if (segment) segments.push(segment)
      segment = ''
      return
    }
    segment += `${segment ? ' L' : 'M'} ${point.x} ${point.y}`
  })
  if (segment) segments.push(segment)

  const careerAverage = available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null
  const lastFiveValues = available.slice(-5)
  const lastFive = lastFiveValues.length ? lastFiveValues.reduce((sum, value) => sum + value, 0) / lastFiveValues.length : null
  const careerHigh = available.length ? Math.max(...available) : null
  const trend = available.length >= 2 ? available.at(-1)! - available[Math.max(0, available.length - 5)] : null

  return <section className="mb-12 rounded-3xl border border-neutral-800 bg-[#111] p-5 md:p-7">
    <div className="flex flex-wrap items-start justify-between gap-5"><div><div className="text-xs font-black uppercase tracking-[.22em] text-purple-400">Athlete analytics</div><h2 className="mt-1 text-3xl font-black text-white">Performance Over Time</h2><p className="mt-1 text-sm text-neutral-500">Chronological non-forfeit game performance. Missing Process samples remain gaps, never zeroes.</p></div><div className="flex flex-wrap gap-2" aria-label="Trend averaging window">{([[1, 'Per Game'], [3, '3-Game Average'], [5, '5-Game Average']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setWindowMode(value)} aria-pressed={windowMode === value} className={`min-h-10 rounded-full px-4 py-2 text-xs font-bold ${windowMode === value ? 'bg-purple-700 text-white' : 'border border-neutral-700 text-neutral-400'}`}>{label}</button>)}</div></div>

    <div className="mt-6 grid gap-3 md:grid-cols-2"><label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Competition<select value={competition} onChange={(event) => setCompetition(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-neutral-700 bg-[#181818] px-3 text-sm normal-case text-white"><option>All Competitions</option>{competitions.map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Format<select value={format} onChange={(event) => setFormat(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-neutral-700 bg-[#181818] px-3 text-sm normal-case text-white"><option>All Formats</option>{formats.map((value) => <option key={value}>{value}</option>)}</select></label></div>

    <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Trend metric">{(Object.keys(labels) as Metric[]).map((key) => <button key={key} type="button" onClick={() => setMetric(key)} aria-pressed={metric === key} className={`min-h-10 min-w-max rounded-full px-4 py-2 text-xs font-bold ${metric === key ? 'bg-purple-700 text-white' : 'border border-neutral-700 text-neutral-400'}`}>{labels[key]}</button>)}</div>

    {filtered.length ? <><div className="mt-5 overflow-x-auto rounded-2xl border border-neutral-800 bg-black/20 p-3"><svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] min-w-[760px]" role="img" aria-label={`${labels[metric]} across ${filtered.length} filtered games`}>{[0, .25, .5, .75, 1].map((fraction) => <g key={fraction}><line x1={insetX} x2={width-insetX} y1={height-insetY-fraction*(height-insetY*2)} y2={height-insetY-fraction*(height-insetY*2)} stroke="rgba(255,255,255,.08)"/><text x="4" y={height-insetY-fraction*(height-insetY*2)+4} fill="#737373" fontSize="11">{formatValue(metric,max*fraction)}</text></g>)}{filtered.map((point,index) => index > 0 && point.seriesId !== filtered[index-1].seriesId ? <line key={`series-${point.id}`} x1={coordinates[index].x-29} x2={coordinates[index].x-29} y1={insetY} y2={height-insetY} stroke="rgba(175,105,238,.28)" strokeDasharray="4 5"/> : null)}{segments.map((path,index) => <path key={index} d={path} fill="none" stroke="#AF69EE" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"/>)}{coordinates.map((coordinate,index) => coordinate.y === null ? <g key={filtered[index].id}><line x1={coordinate.x-5} x2={coordinate.x+5} y1={height/2-5} y2={height/2+5} stroke="#525252"/><line x1={coordinate.x+5} x2={coordinate.x-5} y1={height/2-5} y2={height/2+5} stroke="#525252"/><title>{`${filtered[index].date} vs ${filtered[index].opponent}: ${labels[metric]} unavailable`}</title></g> : <g key={filtered[index].id}><circle cx={coordinate.x} cy={coordinate.y} r="8" fill="#0b0b0b" stroke="#d8b4fe" strokeWidth="3"><title>{`${filtered[index].date} · ${filtered[index].opponent} · ${filtered[index].competition} · ${filtered[index].circuit} · ${filtered[index].format} · ${filtered[index].result} · ${labels[metric]} ${formatValue(metric,coordinate.value)}`}</title></circle><text x={coordinate.x} y={Math.max(14,coordinate.y-14)} textAnchor="middle" fill="#e5e5e5" fontSize="12">{formatValue(metric,coordinate.value)}</text><text x={coordinate.x} y={height-10} textAnchor="middle" fill="#525252" fontSize="10">{filtered[index].gameNumber ? `G${filtered[index].gameNumber}` : index+1}</text></g>)}</svg></div><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"><Summary label="Career Avg" value={formatValue(metric,careerAverage)}/><Summary label="Last 5" value={formatValue(metric,lastFive)}/><Summary label="Career High" value={formatValue(metric,careerHigh)}/><Summary label="Current 5-Game Trend" value={trend === null ? 'Unavailable' : `${trend > 0 ? '+' : ''}${formatValue(metric,trend)}`}/></div></> : <div className="mt-5 rounded-2xl border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-500">No games match these competition and format filters.</div>}
  </section>
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-neutral-800 bg-black/20 p-4"><div className="text-xs font-bold uppercase text-neutral-600">{label}</div><div className="mt-1 text-xl font-black text-white">{value}</div></div>
}
