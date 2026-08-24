'use client'

import { useState } from 'react'

type TrendPoint = {
  id: number
  date: string
  opponent: string
  goals: number
  assists: number
  saves: number
}

type Metric = 'goals' | 'assists' | 'saves'

const labels: Record<Metric, string> = {
  goals: 'Goals',
  assists: 'Assists',
  saves: 'Saves',
}

export function PlayerTrendChart({ points }: { points: TrendPoint[] }) {
  const [metric, setMetric] = useState<Metric>('goals')
  if (!points.length) return null

  const width = 720
  const height = 220
  const inset = 24
  const values = points.map((point) => point[metric])
  const max = Math.max(1, ...values)
  const coordinates = values.map((value, index) => ({
    x: points.length === 1 ? width / 2 : inset + (index / (points.length - 1)) * (width - inset * 2),
    y: height - inset - (value / max) * (height - inset * 2),
  }))
  const path = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  return <section className="mb-12 rounded-2xl border border-neutral-800 bg-[#111] p-5 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-2xl font-bold text-white">Performance Trend</h2><p className="mt-1 text-sm text-neutral-500">Last {points.length} non-forfeit games in chronological order.</p></div>
      <div className="flex gap-2" aria-label="Trend metric">
        {(Object.keys(labels) as Metric[]).map((key) => <button key={key} type="button" onClick={() => setMetric(key)} aria-pressed={metric === key} className={`rounded-full px-3 py-1.5 text-xs font-bold ${metric === key ? 'bg-purple-700 text-white' : 'border border-neutral-700 text-neutral-400'}`}>{labels[key]}</button>)}
      </div>
    </div>
    <div className="mt-5 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px]" role="img" aria-label={`${labels[metric]} across the last ${points.length} games`}>
        {[0, .5, 1].map((fraction) => <line key={fraction} x1={inset} x2={width-inset} y1={height-inset-fraction*(height-inset*2)} y2={height-inset-fraction*(height-inset*2)} stroke="rgba(255,255,255,.08)" />)}
        <path d={path} fill="none" stroke="#AF69EE" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        {coordinates.map((coordinate, index) => <g key={points[index].id}><circle cx={coordinate.x} cy={coordinate.y} r="6" fill="#0b0b0b" stroke="#d8b4fe" strokeWidth="3"><title>{`${points[index].date} vs ${points[index].opponent}: ${values[index]} ${labels[metric].toLowerCase()}`}</title></circle><text x={coordinate.x} y={Math.max(14, coordinate.y-12)} textAnchor="middle" fill="#e5e5e5" fontSize="12">{values[index]}</text></g>)}
      </svg>
    </div>
    <div className="mt-2 flex justify-between text-xs text-neutral-600"><span>{points[0].date}</span><span>{points.at(-1)?.date}</span></div>
  </section>
}
