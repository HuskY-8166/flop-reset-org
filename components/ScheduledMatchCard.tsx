import Link from 'next/link'
import { formatPublicDate } from '@/lib/results'
import { schedulePhaseLabel } from '@/lib/scheduleOperations'
import { teamHref } from '@/lib/teamRoutes'

type ScheduledMatchCardProps = {
  match: {
    scheduled_id: number
    opponent_name?: string | null
    match_date: string
    scheduled_local_time?: string | null
    match_time?: string | null
    timezone?: string | null
    best_of?: number | null
    competition_phase?: string | null
    stage_label?: string | null
    tier?: string | null
    source_url?: string | null
    teams?: { id?: number | null; name?: string | null; format?: string | null } | null
    competitions?: { name?: string | null } | null
  }
  featured?: boolean
}

export function ScheduledMatchCard({ match, featured = false }: ScheduledMatchCardProps) {
  const teamName = match.teams?.name ?? 'Flop Reset'
  const sourceUrl = /^https:\/\//i.test(match.source_url ?? '') ? match.source_url : null
  return <article className={`min-w-0 rounded-2xl border p-5 ${featured ? 'border-purple-700 bg-purple-950/20 md:p-7' : 'border-neutral-800 bg-[#111]'}`}>
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[.14em] text-purple-300">
      <span>{match.teams?.format ?? 'Format pending'}</span>
      <span className="text-neutral-700">•</span>
      <span>{schedulePhaseLabel(match.competition_phase)}</span>
      {match.best_of ? <><span className="text-neutral-700">•</span><span>BO{match.best_of}</span></> : null}
      {match.tier ? <><span className="text-neutral-700">•</span><span>{match.tier}</span></> : null}
      {match.stage_label ? <><span className="text-neutral-700">•</span><span>{match.stage_label}</span></> : null}
    </div>
    <div className="mt-3 min-w-0 text-xl font-black text-white md:text-2xl">
      {match.teams?.id ? <Link href={teamHref({ id: match.teams.id })} className="hover:underline">{teamName}</Link> : teamName}
      <span className="mx-2 text-neutral-600">vs</span>
      <span className="break-words text-neutral-200">{match.opponent_name ?? 'Opponent TBD'}</span>
    </div>
    <div className="mt-3 text-sm text-neutral-300">{formatPublicDate(match.match_date)} · {match.scheduled_local_time ?? match.match_time ?? 'Time TBD'}{(match.scheduled_local_time ?? match.match_time) && match.timezone ? ` ${match.timezone}` : ''}</div>
    {match.competitions?.name ? <div className="mt-1 text-xs text-neutral-500">{match.competitions.name}</div> : null}
    {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-bold text-purple-300 hover:underline">Verified source ↗</a> : null}
  </article>
}
