'use client'

import Link from 'next/link'
import { useState } from 'react'

type Summary = {
  team: string
  tier: string
  rating: number
  overallRank: number | null
  tierRank: number | null
  lastRoundDelta: number
  threeRoundDelta: number
  peak: number
  matchesTracked: number
  recentForm: string[]
  confidence: string
}

export function PowerRankingsTable({ rows, queryString }: { rows: Summary[]; queryString: string }) {
  const [search, setSearch] = useState('')
  const [tier, setTier] = useState('All Tiers')
  const [sort, setSort] = useState<'rank'|'rating'|'round'|'threeRound'|'peak'>('rank')
  const tiers = [...new Set(rows.map((row) => row.tier))].sort()
  const filtered = rows.filter((row) =>
    row.team.toLowerCase().includes(search.toLowerCase()) && (tier === 'All Tiers' || row.tier === tier)
  ).sort((a,b) => sort === 'rank' ? (a.overallRank??999)-(b.overallRank??999) : sort === 'rating' ? b.rating-a.rating : sort === 'round' ? b.lastRoundDelta-a.lastRoundDelta : sort === 'threeRound' ? b.threeRoundDelta-a.threeRoundDelta : b.peak-a.peak)

  return <section className="mt-12 min-w-0"><div className="flex min-w-0 flex-wrap items-end justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[.22em] text-purple-400">All-team intelligence</div><h2 className="mt-1 text-3xl font-black text-white">Full Rankings</h2></div><div className="grid w-full min-w-0 gap-2 sm:grid-cols-3 lg:w-auto"><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search teams" className="min-h-10 w-full min-w-0 rounded-lg border border-neutral-700 bg-[#111] px-3 text-sm text-white"/><select value={tier} onChange={(event)=>setTier(event.target.value)} className="min-h-10 w-full min-w-0 rounded-lg border border-neutral-700 bg-[#111] px-3 text-sm text-white"><option>All Tiers</option>{tiers.map((value)=><option key={value}>{value}</option>)}</select><select value={sort} onChange={(event)=>setSort(event.target.value as typeof sort)} className="min-h-10 w-full min-w-0 rounded-lg border border-neutral-700 bg-[#111] px-3 text-sm text-white"><option value="rank">Overall Rank</option><option value="rating">Rating</option><option value="round">Round Δ</option><option value="threeRound">3-Round Δ</option><option value="peak">Peak</option></select></div></div><div className="mt-5 max-w-full min-w-0 overflow-x-auto rounded-2xl border border-neutral-800"><table className="min-w-[980px] w-full text-sm"><thead className="bg-[#191919] text-left text-xs uppercase text-neutral-500"><tr><th className="px-4 py-3">Overall</th><th>Team</th><th>Tier</th><th>Tier Rank</th><th>Rating</th><th>Round Δ</th><th>3-Round Δ</th><th>Peak</th><th>Matches</th><th>Form</th><th>Sample</th></tr></thead><tbody>{filtered.map((row) => {const isFlop=/flop reset/i.test(row.team);return <tr key={row.team} className={`border-t border-neutral-800 ${isFlop?'bg-purple-950/20':''}`}><td className="px-4 py-3 font-black text-purple-300">#{row.overallRank}</td><td><Link href={`/power-rankings/team/${encodeURIComponent(row.team)}?${queryString}`} className="font-bold text-white hover:underline">{row.team}</Link></td><td>{row.tier}</td><td>#{row.tierRank}</td><td className="font-mono font-bold">{Math.round(row.rating)}</td><td className={row.lastRoundDelta>=0?'text-emerald-400':'text-red-400'}>{row.lastRoundDelta>=0?'+':''}{row.lastRoundDelta.toFixed(1)}</td><td className={row.threeRoundDelta>=0?'text-emerald-400':'text-red-400'}>{row.threeRoundDelta>=0?'+':''}{row.threeRoundDelta.toFixed(1)}</td><td>{Math.round(row.peak)}</td><td>{row.matchesTracked}</td><td><span className="flex gap-1">{row.recentForm.map((result,index)=><span key={index} className={result==='W'?'text-emerald-400':'text-red-400'}>{result}</span>)}</span></td><td className="text-neutral-500">{row.confidence}</td></tr>})}</tbody></table></div></section>
}
