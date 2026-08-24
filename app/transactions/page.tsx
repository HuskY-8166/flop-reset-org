/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { EmptyState, PageHero, SectionHeader } from '@/components/ui'
export const dynamic='force-dynamic'

export default async function Transactions(){
  const {data:stats}=await supabase.from('match_player_stats').select('player_id, players ( name, teams ( name, format ) ), matches ( match_date )')
  const first=new Map<string,any>()
  ;(stats??[]).forEach((s:any)=>{const name=s.players?.name,date=s.matches?.match_date;if(!name||!date)return;const key=`${name}|${s.players?.teams?.format}`;if(!first.has(key)||date<first.get(key).date)first.set(key,{name,date,team:s.players?.teams?.name??'Unknown',format:s.players?.teams?.format??'Unknown'})})
  const appearances=[...first.values()].sort((a,b)=>b.date.localeCompare(a.date))
  return <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14"><PageHero eyebrow="Roster archive foundation" title="Transactions" description="Verified roster changes will live here without overwriting historical membership. Until dated join/leave records exist, the page shows first recorded competitive appearances only."/>
    <section className="mt-12"><SectionHeader eyebrow="Evidence currently available" title="First Recorded Appearances" description="An appearance date is not presented as a signing date. It only proves the player competed under that squad by this date."/>{appearances.length?<div className="relative ml-3 border-l border-purple-900/60 pl-6">{appearances.map((a)=><article key={`${a.name}-${a.format}`} className="relative mb-4 rounded-xl border border-neutral-800 bg-[#111] p-4"><span className="absolute -left-[31px] top-5 h-3 w-3 rounded-full bg-purple-500"/><div className="text-xs text-neutral-600">{a.date} · First recorded appearance</div><Link href={`/players/${encodeURIComponent(a.name)}`} className="mt-1 inline-block text-lg font-bold text-white hover:underline">{a.name}</Link><div className="text-sm text-neutral-500">{a.team} · {a.format}</div></article>)}</div>:<EmptyState title="No appearance history yet" description="This section will populate from dated competitive player statistics."/>}</section>
    <div className="mt-12 rounded-2xl border border-amber-900/40 bg-amber-950/10 p-5"><h2 className="font-bold text-amber-300">Historical roster model not yet enabled</h2><p className="mt-2 text-sm text-neutral-500">No production schema was changed. A future migration should add player_team_history before Admin can record true joined_at and left_at dates safely.</p></div>
  </main>
}
