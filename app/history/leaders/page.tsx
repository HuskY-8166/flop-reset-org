/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { EmptyState, PageHero, SectionHeader } from '@/components/ui'
export const dynamic = 'force-dynamic'

export default async function Leaders({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  const query = await searchParams
  const { data: stats } = await supabase.from('match_player_stats').select('player_id, goals, assists, saves, shots, score, mvp, players ( name, teams ( name, format ) ), matches ( series_id, is_forfeit )')
  const formats=[...new Set((stats??[]).map((s:any)=>s.players?.teams?.format).filter(Boolean))], selected=query.format&&formats.includes(query.format)?query.format:'All'
  const map=new Map<string,any>()
  ;(stats??[]).filter((s:any)=>!s.matches?.is_forfeit&&(selected==='All'||s.players?.teams?.format===selected)).forEach((s:any)=>{const name=s.players?.name??'Unknown',format=s.players?.teams?.format??'Unknown',key=`${name}|${format}`,r=map.get(key)??{name,team:s.players?.teams?.name??'Unknown',format,games:0,series:new Set<number>(),goals:0,assists:0,saves:0,shots:0,score:0,mvps:0};r.games++;if(s.matches?.series_id!=null)r.series.add(s.matches.series_id);r.goals+=Number(s.goals??0);r.assists+=Number(s.assists??0);r.saves+=Number(s.saves??0);r.shots+=Number(s.shots??0);r.score+=Number(s.score??0);r.mvps+=s.mvp?1:0;map.set(key,r)})
  const rows=[...map.values()].map((r)=>({...r,seriesCount:r.series.size}))
  const categories=[['Games','games'],['Series','seriesCount'],['Goals','goals'],['Assists','assists'],['Saves','saves'],['Shots','shots'],['Score','score'],['MVPs','mvps']] as const
  return <main className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14"><PageHero eyebrow="Career archive" title="All-Time Leaders" description="Competitive career totals across every recorded Flop Reset player identity, kept separate by format."/>
    <nav className="my-8 flex gap-2">{['All',...formats].map((f)=><Link key={f} href={f==='All'?'/history/leaders':`/history/leaders?format=${f}`} className={`rounded-full px-4 py-2 text-sm font-bold no-underline ${selected===f?'bg-purple-700 text-white':'border border-neutral-800 bg-[#151515] text-neutral-400'}`}>{f}</Link>)}</nav>
    {!rows.length?<EmptyState title="No leaders yet" description={`No ${selected==='All'?'':`${selected} `}competitive player statistics are available.`}/>:<section><SectionHeader eyebrow="Competitive totals" title={`${selected} Career Leaderboards`} description="Forfeits are excluded. Players with multiple formats remain separate so totals stay interpretable."/><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{categories.map(([label,key])=>{const leaders=[...rows].filter((r)=>r[key]>0).sort((a,b)=>b[key]-a[key]).slice(0,5);return <article key={key} className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><div className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-4 space-y-3">{leaders.map((r,index)=><div key={`${r.name}-${r.format}`} className="flex items-start gap-3 border-t border-neutral-800 pt-3 first:border-0 first:pt-0"><span className="w-5 font-mono text-neutral-600">{index+1}</span><div className="min-w-0 flex-1"><Link href={`/players/${encodeURIComponent(r.name)}`} className="font-bold text-white hover:underline">{r.name}</Link><div className="text-xs text-neutral-600">{r.team} · {r.format}</div></div><span className="font-mono font-bold text-purple-300">{r[key].toLocaleString()}</span></div>)}</div></article>})}</div></section>}
  </main>
}
