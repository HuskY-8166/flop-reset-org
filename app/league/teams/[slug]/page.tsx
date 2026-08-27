/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, PageHero, SectionHeader, StatCard } from '@/components/ui'
import { competitionIdentity } from '@/lib/competitions'
import { calculateEloWithHistory, type LeagueMatch } from '@/lib/elo'
import { directoryCoverage, normalizeLeagueIdentity, safePublicImageUrl } from '@/lib/leagueDirectory'
import { formatPublicDate, getSeriesOutcome } from '@/lib/results'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [{ data }, { data: override }] = await Promise.all([
    supabase.from('public_competition_entries').select('display_name_snapshot').eq('slug', slug).maybeSingle(),
    supabase.from('public_page_content_overrides').select('seo_title, seo_description').eq('page_key', `league-team:${slug}`).maybeSingle(),
  ])
  return { title: override?.seo_title || (data ? `${data.display_name_snapshot} — League Team` : 'League Team — Flop Reset'), description: override?.seo_description || undefined }
}

export default async function LeagueTeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const entryResult = await supabase.from('public_competition_entries').select('*').eq('slug', slug).maybeSingle()
  const entry = entryResult.data as any
  if (!entry) return <main className="mx-auto max-w-5xl px-4 py-16"><EmptyState title="League team not found" description="This entry may not have been synced yet, or the directory migration is still pending." actionHref="/competitions" actionLabel="Browse competitions" /></main>
  const [competitionResult, rosterResult, leagueResult, meetingResult, pageResult] = await Promise.all([
    supabase.from('competitions').select('*').eq('id', entry.competition_id).maybeSingle(),
    supabase.from('public_competition_roster_members').select('*').eq('entry_id', entry.entry_id).order('created_at'),
    supabase.from('league_matches').select('id, competition_id, format, round, tier, team_a, team_b, score_a, score_b, status, match_date, batch_label').eq('competition_id', entry.competition_id),
    entry.opponent_id
      ? supabase.from('series').select('series_id, series_date, opponent_name, flop_reset_team_id, teams(name, format), matches(*)').eq('opponent_id', entry.opponent_id).order('series_date', { ascending: false })
      : entry.fr_team_id
        ? supabase.from('series').select('series_id, series_date, opponent_name, flop_reset_team_id, teams(name, format), matches(*)').eq('flop_reset_team_id', entry.fr_team_id).eq('competition_id', entry.competition_id).order('series_date', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    supabase.from('public_page_content_overrides').select('*').eq('page_key', `league-team:${slug}`).maybeSingle(),
  ])
  const competition = competitionResult.data
  const identity = competitionIdentity(competition ?? {})
  if (pageResult.data?.is_visible === false) return <main className="mx-auto max-w-5xl px-4 py-16"><EmptyState title="League team page unavailable" description="This page is currently hidden by an administrator." actionHref={`/competitions/${entry.competition_id}/teams`} actionLabel="Team directory" /></main>
  const allLeagueMatches = (leagueResult.data ?? []) as LeagueMatch[]
  const teamName = normalizeLeagueIdentity(entry.display_name_snapshot)
  const teamMatches = allLeagueMatches.filter((match) => normalizeLeagueIdentity(match.team_a) === teamName || normalizeLeagueIdentity(match.team_b) === teamName)
  const engine = allLeagueMatches.length ? calculateEloWithHistory(allLeagueMatches) : null
  const power = engine?.teamSummaries.find((team) => normalizeLeagueIdentity(team.team) === teamName) ?? null
  const meetings = (meetingResult.data ?? []) as any[]
  const roster = ((rosterResult.data ?? []) as any[]).filter((member) => member.is_current)
  const managers = roster.filter((member: any) => member.role === 'manager')
  const players = roster.filter((member: any) => member.role !== 'manager')
  const meetingOutcomes = meetings.map((meeting) => getSeriesOutcome(meeting.matches ?? [], meeting))
  const seriesWins = meetingOutcomes.filter((outcome) => outcome.won).length
  const seriesLosses = meetingOutcomes.filter((outcome) => outcome.lost).length
  const gameWins = meetingOutcomes.reduce((sum, outcome) => sum + outcome.wins, 0)
  const gameLosses = meetingOutcomes.reduce((sum, outcome) => sum + outcome.losses, 0)
  const coverage = directoryCoverage({ rosterCount: roster.length, leagueResultCount: teamMatches.length, hasPower: Boolean(power), frMeetingCount: meetings.length, detailedReplayCount: meetings.reduce((sum, meeting) => sum + (meeting.matches ?? []).length, 0) })
  const logoUrl = safePublicImageUrl(entry.logo_url_snapshot)

  return <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-10 md:px-8 md:py-14">
    <PageHero eyebrow={`${identity.league} · League Team`} title={pageResult.data?.title_override || entry.display_name_snapshot} description={pageResult.data?.subtitle_override || `${identity.seasonLabel} · ${competition?.format ?? 'Format TBD'} · ${competition?.region ?? 'Region TBD'}${entry.tier ? ` · Tier ${entry.tier}` : ''}`}>
      <div aria-label={`${entry.display_name_snapshot} logo`} style={logoUrl ? { backgroundImage: `url(${logoUrl})`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined} className={`mb-5 grid h-20 w-20 place-items-center rounded-2xl text-xl font-black ${entry.fr_team_id ? 'bg-purple-700' : 'bg-neutral-800'}`}>{logoUrl ? <span className="sr-only">{entry.display_name_snapshot}</span> : String(entry.display_name_snapshot).split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase()}</div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><StatCard label="League Record" value={teamMatches.length ? `${teamMatches.filter((match) => teamWon(match, entry.display_name_snapshot)).length}–${teamMatches.filter((match) => !teamWon(match, entry.display_name_snapshot)).length}` : '—'} /><StatCard label="Power Rank" value={power?.overallRank ? `#${power.overallRank}` : '—'} /><StatCard label="Power Rating" value={power ? power.rating.toFixed(0) : '—'} /><StatCard label="FR Meetings" value={meetings.length || '—'} /></div>
      <div className="mt-5 flex flex-wrap gap-2 text-xs">{Object.entries(coverage).map(([key, active]) => <span key={key} className={`rounded-full border px-3 py-1 ${active ? 'border-emerald-800 text-emerald-300' : 'border-neutral-800 text-neutral-600'}`}>{coverageLabel(key)}</span>)}</div>
    </PageHero>
    {pageResult.data?.manual_callout && <div className="mt-5 rounded-xl border border-purple-800 bg-purple-950/20 p-4 text-sm text-purple-100">{pageResult.data.manual_callout}</div>}

    <section className="mt-12"><SectionHeader eyebrow="Event-specific membership" title="Roster" description="This roster snapshot is preserved independently from the team’s future membership." />
      {roster.length ? <div className="grid gap-4 md:grid-cols-2"><RosterGroup title="Players & Captains" members={players} /><RosterGroup title="Management" members={managers} /></div> : <EmptyState title="Roster not available" description="The league entry is verified, but no event roster has been applied yet." />}
    </section>

    <section className="mt-12"><SectionHeader eyebrow="Head-to-head" title="Vs Flop Reset" />
      {meetings.length ? <div className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><StatCard label="Series" value={`${seriesWins}–${seriesLosses}`} /><StatCard label="Games" value={`${gameWins}–${gameLosses}`} /><StatCard label="Meetings" value={meetings.length} /><StatCard label="Last Meeting" value={formatPublicDate(meetings[0]?.series_date)} /></div><div className="mt-4 space-y-2">{meetings.slice(0, 5).map((meeting) => <Link key={meeting.series_id} href={`/matches/${meeting.series_id}`} className="block rounded-lg border border-neutral-800 p-3 text-sm text-neutral-300 no-underline hover:border-purple-700">{formatPublicDate(meeting.series_date)} · {meeting.teams?.name} vs {meeting.opponent_name}</Link>)}</div></div> : <EmptyState title="Flop Reset has not faced this team yet." description="No fake 0–0 rivalry statistics are shown. This page exists because the team is a verified competition entry." />}
    </section>

    <section className="mt-12"><SectionHeader eyebrow="League-wide evidence" title="Recent League Results" />{teamMatches.length ? <div className="space-y-2">{teamMatches.slice(-6).reverse().map((match) => <div key={String(match.id)} className="flex flex-wrap justify-between gap-2 rounded-xl border border-neutral-800 bg-[#111] p-4"><span>{match.team_a} <span className="text-neutral-600">vs</span> {match.team_b}</span><span className="font-black text-purple-300">{match.score_a}–{match.score_b}</span></div>)}</div> : <EmptyState title="No league results linked" description="Registration does not automatically make an entry Power-tracked or result-complete." />}</section>
    <section className="mt-12"><SectionHeader eyebrow="Participation history" title="Competition History" /><Link href={`/competitions/${entry.competition_id}/teams`} className="block rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-700"><div className="font-black">{identity.seasonLabel}</div><div className="mt-1 text-sm text-neutral-500">{competition?.region ?? 'Region TBD'} · {competition?.format ?? 'Format TBD'}{entry.tier ? ` · Tier ${entry.tier}` : ''}</div></Link></section>
  </main>
}

function teamWon(match: LeagueMatch, name: string) { const first = normalizeLeagueIdentity(match.team_a) === normalizeLeagueIdentity(name); const a = Number(match.score_a); const b = Number(match.score_b); return first ? a > b : b > a }
function coverageLabel(key: string) { return ({ leagueEntry: 'League Entry', roster: 'Roster', leagueResults: 'League Results', power: 'Power', frMeetings: 'FR Meetings', detailedReplayStats: 'Detailed Replay Stats' } as Record<string, string>)[key] ?? key }
function RosterGroup({ title, members }: { title: string; members: any[] }) { return <div className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><h3 className="font-black text-white">{title}</h3>{members.length ? <div className="mt-4 space-y-2">{members.map((member) => member.league_player_slug ? <Link key={member.roster_member_id} href={`/league/players/${member.league_player_slug}`} className="flex justify-between rounded-lg bg-black/25 p-3 text-white no-underline hover:text-purple-300"><span>{member.display_name_snapshot}</span><span className="text-xs uppercase text-neutral-500">{member.role}</span></Link> : <div key={member.roster_member_id} className="flex justify-between rounded-lg bg-black/25 p-3"><span>{member.display_name_snapshot}</span><span className="text-xs uppercase text-neutral-500">{member.role}</span></div>)}</div> : <p className="mt-3 text-sm text-neutral-600">None recorded.</p>}</div> }
