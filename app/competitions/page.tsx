/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { EmptyState, PageHero, ResultBadge, SectionHeader } from '@/components/ui'
export const dynamic='force-dynamic'

export default async function Competitions(){
  const [{data:competitions},{data:series},{data:scheduled}]=await Promise.all([
    supabase.from('competitions').select('id, name, format, host').order('id'),
    supabase.from('series').select('competition_id, series_id, matches ( flop_reset_score, opponent_score )'),
    supabase.from('scheduled_matches').select('competition_id, scheduled_id').eq('status','scheduled'),
  ])
  return <main className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14"><PageHero eyebrow="League & tournament archive" title="Competitions" description="Current and past competitive contexts stay accessible as Flop Reset expands into new leagues and events."/>
    <section className="mt-12"><SectionHeader eyebrow="Competition library" title="Recorded Competitions" description="Each hub connects participating Flop Reset teams with its schedule, results, and player leaders."/>{competitions?.length?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{competitions.map((c:any)=>{const results=(series??[]).filter((s:any)=>s.competition_id===c.id),upcoming=(scheduled??[]).filter((s:any)=>s.competition_id===c.id).length;let wins=0,losses=0;results.forEach((s:any)=>{const w=s.matches?.filter((m:any)=>m.flop_reset_score>m.opponent_score).length??0,l=s.matches?.filter((m:any)=>m.flop_reset_score<m.opponent_score).length??0;if(w>l)wins++;else if(l>w)losses++});return <Link key={c.id} href={`/competitions/${c.id}`} className="group rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:-translate-y-0.5 hover:border-purple-800"><div className="flex items-start justify-between"><div><div className="text-xs font-bold uppercase text-purple-400">{c.format}</div><h2 className="mt-1 text-2xl font-black">{c.name}</h2><p className="mt-1 text-sm text-neutral-600">{c.host||'Competition host not recorded'}</p></div><ResultBadge wins={wins} losses={losses}/></div><div className="mt-5 flex gap-4 text-sm text-neutral-500"><span>{results.length} completed series</span><span>{upcoming} upcoming</span></div><div className="mt-4 text-sm text-purple-300">Open competition hub →</div></Link>})}</div>:<EmptyState title="No competitions recorded" description="Competition hubs will appear after competition metadata is created in Admin."/>}</section>
  </main>
}
