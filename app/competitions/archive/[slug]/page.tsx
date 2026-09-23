/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from 'next'
import Link from 'next/link'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { PlayoffBracket } from '@/components/PlayoffBracket'
import { EmptyState, PageHero, SectionHeader, SeriesResultBadge, StatCard } from '@/components/ui'
import { competitionIdentity, getCompetitionSummary } from '@/lib/competitions'
import { fetchAllPages } from '@/lib/paginatedQuery'
import { normalizePlayoffData } from '@/lib/playoffs'
import { formatPublicDate, getGameOutcome, getSeriesOutcome } from '@/lib/results'
import { groupCompetitionsBySeason } from '@/lib/seasons'
import { competitionRanks } from '@/lib/stats'
import { supabase } from '@/lib/supabase'
import { teamHref } from '@/lib/teamRoutes'

export const dynamic = 'force-dynamic'

const loadSeasonContext = cache(async (slug: string) => {
  const [seasonResult, competitionsResult] = await Promise.all([
    supabase.from('public_competition_seasons').select('*').eq('slug', slug).maybeSingle(),
    supabase.from('competitions').select('*').order('id'),
  ])
  if (competitionsResult.error) return { group: null, error: competitionsResult.error.message }
  const groups = groupCompetitionsBySeason((competitionsResult.data ?? []) as any[], seasonResult.data ? [seasonResult.data] : [])
  return { group: groups.find((candidate) => candidate.slug === slug) ?? null, error: null }
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { group } = await loadSeasonContext(slug)
  if (!group) return { title: 'Competition Archive — Flop Reset' }
  return {
    title: `${group.league} — ${group.name} ${group.year} Archive`,
    description: `Permanent results, rosters, statistics, placements, and playoff history for ${group.league} ${group.name} ${group.year}.`,
  }
}

export default async function CompetitionArchive({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { group, error } = await loadSeasonContext(slug)
  if (error) return <main className="mx-auto max-w-5xl px-4 py-16"><EmptyState title="Archive unavailable" description="The competition library could not be loaded. Please try again shortly." actionHref="/competitions" actionLabel="Competition library" /></main>
  if (!group) notFound()

  const competitionIds = group.competitions.map((competition) => Number(competition.id)).filter(Number.isFinite)
  const [series, scheduled, stats, entriesResult, rosterResult, awardsResult, bracketResult] = await Promise.all([
    fetchAllPages<any>((from, to) => supabase.from('series')
      .select('series_id, competition_id, competition_phase, opponent_name, opponent_id, series_date, notes, is_forfeit, result_override, flop_reset_team_id, teams ( id, name, format ), matches ( * )')
      .in('competition_id', competitionIds).order('series_date', { ascending: false }).range(from, to)),
    fetchAllPages<any>((from, to) => supabase.from('scheduled_matches')
      .select('scheduled_id, competition_id, opponent_name, match_date, match_time, status, teams ( id, name, format )')
      .in('competition_id', competitionIds).range(from, to)),
    fetchAllPages<any>((from, to) => supabase.from('match_player_stats')
      .select('player_id, goals, assists, saves, shots, score, mvp, players ( name ), matches!inner ( match_id, competition_id, match_date, is_forfeit, opponent_name, flop_reset_score, opponent_score, teams ( id, name, format ) )')
      .in('matches.competition_id', competitionIds).range(from, to)),
    supabase.from('public_competition_entries').select('*').in('competition_id', competitionIds),
    supabase.from('public_competition_roster_members').select('*').in('competition_id', competitionIds).order('created_at'),
    group.seasonId
      ? supabase.from('public_season_awards').select('*').eq('season_id', group.seasonId).order('award_type')
      : Promise.resolve({ data: [], error: null }),
    supabase.from('playoff_brackets').select('*').in('competition_id', competitionIds).neq('status', 'hidden').order('tier'),
  ])

  const entries = entriesResult.data ?? []
  const roster = rosterResult.data ?? []
  const awards = awardsResult.data ?? []
  const dataErrors = [entriesResult.error, rosterResult.error, bracketResult.error].filter(Boolean)
  const summaries = group.competitions.map((competition) => getCompetitionSummary({
    competition,
    series: series.filter((row) => Number(row.competition_id) === Number(competition.id)),
    scheduledMatches: scheduled.filter((row) => Number(row.competition_id) === Number(competition.id)),
  }))
  const officialSeries = summaries.flatMap((summary) => summary.officialSeries as any[])
  const totals = summaries.reduce((result, summary) => ({
    seriesWins: result.seriesWins + summary.seriesWins,
    seriesLosses: result.seriesLosses + summary.seriesLosses,
    gameWins: result.gameWins + summary.gameWins,
    gameLosses: result.gameLosses + summary.gameLosses,
    playedGames: result.playedGames + summary.playedGames,
  }), { seriesWins: 0, seriesLosses: 0, gameWins: 0, gameLosses: 0, playedGames: 0 })

  const teamResults = buildTeamResults(officialSeries)
  const playerLeaders = buildPlayerLeaders(stats)
  const bestGames = buildBestGames(stats)
  const officialPlacements = entries.filter((entry: any) => entry.regular_season_finish || entry.final_placement || entry.placement_label)
  const frEntries = entries.filter((entry: any) => entry.fr_team_id)
  const rosterByEntry = new Map<number, any[]>()
  for (const member of roster) {
    const list = rosterByEntry.get(Number(member.entry_id)) ?? []
    list.push(member)
    rosterByEntry.set(Number(member.entry_id), list)
  }
  const brackets = await loadPlayoffBrackets(bracketResult.data ?? [])
  const formatList = group.competitions.map((competition) => competition.format).filter(Boolean).join(' · ')
  const completed = group.status === 'completed' || group.status === 'archived'

  return <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-10 md:px-8 md:py-14">
    <Link href="/competitions" className="mb-6 inline-block text-sm font-semibold text-purple-300 hover:underline">← Competition library</Link>
    <PageHero eyebrow={`${group.league} · Permanent Archive`} title={`${group.name} ${group.year}`} description={group.summary || `The permanent Flop Reset archive for ${group.league} ${group.name} ${group.year}. Format-specific results remain separate while the season is preserved as one historical chapter.`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full border px-4 py-2 text-sm font-black tracking-wide ${completed ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300' : 'border-purple-700 bg-purple-950/30 text-purple-300'}`}>{completed ? 'COMPLETED' : group.status.toUpperCase()}</span>
        <span className="text-sm text-neutral-500">{formatList || 'Formats not recorded'}</span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="FR Teams" value={teamResults.length} />
        <StatCard label="Series" value={officialSeries.length} />
        <StatCard label="Series Record" value={`${totals.seriesWins}–${totals.seriesLosses}`} />
        <StatCard label="Played Games" value={totals.playedGames} />
        <StatCard label="Game Record" value={`${totals.gameWins}–${totals.gameLosses}`} />
        <StatCard label="Formats" value={group.competitions.length} />
      </div>
    </PageHero>

    {dataErrors.length > 0 && <div className="mt-6 rounded-2xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-200">Some supporting archive information is temporarily unavailable. Canonical match results have not been replaced or guessed.</div>}

    <nav className="sticky top-14 z-20 my-8 max-w-full overflow-x-auto rounded-xl border border-neutral-800 bg-[#0d0d0d]/95 px-4 py-3 backdrop-blur"><div className="flex min-w-max gap-5 text-xs font-bold uppercase tracking-wide text-neutral-500">{[['formats', 'Formats'], ['teams', 'FR Teams'], ['standings', 'Placements'], ['leaders', 'Leaders'], ['playoffs', 'Playoffs'], ['results', 'Results'], ['awards', 'Awards']].map(([id, label]) => <a key={id} href={`#${id}`} className="hover:text-purple-300">{label}</a>)}</div></nav>

    <section id="formats" className="scroll-mt-28">
      <SectionHeader eyebrow="Season structure" title="Competition Formats" description="Each format keeps independent standings, statistics, rankings, and playoff history." />
      <div className="grid gap-4 md:grid-cols-2">{group.competitions.map((competition, index) => {
        const identity = competitionIdentity(competition)
        const summary = summaries[index]
        return <Link key={String(competition.id)} href={`/competitions/${competition.id}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-700"><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-wide text-purple-400">{identity.format}</div><h3 className="mt-1 text-2xl font-black">{competition.name ?? identity.displayName}</h3></div><SeriesResultBadge result={summary.seriesWins > summary.seriesLosses ? 'W' : summary.seriesWins < summary.seriesLosses ? 'L' : 'T'} wins={summary.seriesWins} losses={summary.seriesLosses} /></div><div className="mt-4 text-sm text-neutral-500">{summary.playedGames} played games · {summary.gameWins}–{summary.gameLosses} game record</div></Link>
      })}</div>
    </section>

    <section id="teams" className="mt-14 scroll-mt-28">
      <SectionHeader eyebrow="Organization performance" title="Flop Reset Teams" description="Records are calculated from canonical season series; event roster snapshots are preserved independently from current rosters." />
      {teamResults.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{teamResults.map((team) => {
        const entry = frEntries.find((candidate: any) => Number(candidate.fr_team_id) === team.id && Number(candidate.competition_id) === team.competitionId)
        const members = entry ? rosterByEntry.get(Number(entry.entry_id)) ?? [] : []
        return <article key={`${team.competitionId}-${team.id}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold uppercase text-purple-400">{team.format}</div><Link href={teamHref({ id: team.id })} className="mt-1 block text-2xl font-black text-white hover:underline">{team.name}</Link></div><span className="font-black text-white">{team.seriesWins}–{team.seriesLosses}</span></div><div className="mt-3 text-sm text-neutral-500">Games {team.gameWins}–{team.gameLosses}{entry?.seed ? ` · Playoff seed #${entry.seed}` : ''}</div><div className="mt-4 border-t border-neutral-800 pt-4"><div className="text-xs font-bold uppercase text-neutral-600">Archived roster</div>{members.length ? <div className="mt-2 flex flex-wrap gap-2">{members.map((member: any) => <span key={member.roster_member_id} className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300">{member.display_name_snapshot}{member.role !== 'player' ? ` · ${member.role}` : ''}</span>)}</div> : <p className="mt-2 text-sm text-neutral-600">No verified event roster snapshot is linked yet.</p>}</div></article>
      })}</div> : <EmptyState title="No completed Flop Reset series" description="Teams will appear after canonical season results are linked." />}
    </section>

    <section id="standings" className="mt-14 scroll-mt-28">
      <SectionHeader eyebrow="Verified finish data" title="Final Placements & Seeds" description="Official placements are shown only when explicitly recorded. Match-derived guesses are never substituted for league tiebreakers." />
      {officialPlacements.length ? <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#111]"><table className="min-w-[680px] text-sm"><thead><tr className="bg-[#191919] text-left text-xs uppercase text-neutral-500"><th className="px-4 py-3">Format</th><th className="px-4 py-3">Team</th><th className="px-4 py-3">Regular Season</th><th className="px-4 py-3">Playoff Seed</th><th className="px-4 py-3">Final Placement</th></tr></thead><tbody>{officialPlacements.sort(placementSort).map((entry: any) => <tr key={entry.entry_id} className="border-t border-neutral-800"><td className="px-4 py-3 text-purple-300">{entry.competition_format}</td><td className="px-4 py-3 font-bold text-white"><Link href={`/league/teams/${entry.slug}`} className="hover:underline">{entry.display_name_snapshot}</Link></td><td className="px-4 py-3">{ordinal(entry.regular_season_finish)}</td><td className="px-4 py-3">{entry.seed ? `#${entry.seed}` : '—'}</td><td className="px-4 py-3">{entry.placement_label || ordinal(entry.final_placement)}</td></tr>)}</tbody></table></div> : <EmptyState title="Final placements not recorded yet" description="The archive will not infer official standings from incomplete results or unknown league tiebreakers." />}
    </section>

    <section id="leaders" className="mt-14 scroll-mt-28">
      <SectionHeader eyebrow="Verified player statistics" title="Season Leaders" description="Forfeits never create player statistics. Each format remains visible on the underlying competition page." />
      {playerLeaders.length ? <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#111]"><table className="min-w-[760px] text-sm"><thead><tr className="bg-[#191919] text-left text-xs uppercase text-neutral-500"><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Player</th><th className="px-4 py-3">Team</th><th className="px-4 py-3">GP</th><th className="px-4 py-3">Goals</th><th className="px-4 py-3">Assists</th><th className="px-4 py-3">Saves</th><th className="px-4 py-3">Score</th></tr></thead><tbody>{playerLeaders.slice(0, 10).map(({ row: player, rank }) => <tr key={`${player.playerId}-${player.teamId}`} className="border-t border-neutral-800"><td className="px-4 py-3 text-neutral-600">#{rank}</td><td className="px-4 py-3"><Link href={`/players/${encodeURIComponent(player.name)}`} className="font-bold text-white hover:underline">{player.name}</Link></td><td className="px-4 py-3 text-neutral-500">{player.team}</td><td className="px-4 py-3">{player.games}</td><td className="px-4 py-3 font-bold text-purple-300">{player.goals}</td><td className="px-4 py-3">{player.assists}</td><td className="px-4 py-3">{player.saves}</td><td className="px-4 py-3">{player.score}</td></tr>)}</tbody></table></div> : <EmptyState title="No player statistics available" description="Verified Ballchasing player rows have not been linked to this season." />}
      {bestGames.length ? <div className="mt-8"><SectionHeader eyebrow="Single-game peaks" title="Best Verified Performances" /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{bestGames.map((game) => <article key={game.key} className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><div className="text-xs font-bold uppercase text-purple-400">{game.format}</div><div className="mt-1 text-xl font-black text-white">{game.name}</div><div className="mt-3 text-3xl font-black text-white">{game.goals} G · {game.score} score</div><div className="mt-2 text-sm text-neutral-500">{game.team} vs {game.opponent} · {formatPublicDate(game.date)}</div></article>)}</div></div> : null}
    </section>

    <section id="playoffs" className="mt-14 scroll-mt-28">
      <SectionHeader eyebrow="Permanent postseason record" title="Playoff Brackets" description="Bracket topology and linked canonical results remain attached to their original format competition." />
      {brackets.length ? <PlayoffBracket brackets={brackets} /> : <EmptyState title="No verified bracket available" description="A bracket will appear only after its structure has been reviewed and linked to this season." />}
    </section>

    <section id="results" className="mt-14 scroll-mt-28">
      <SectionHeader eyebrow="Complete competitive history" title="Flop Reset Match History" description="Regular-season and playoff series remain in their canonical competition and format." />
      {officialSeries.length ? <div className="space-y-3">{officialSeries.sort((a, b) => String(b.series_date ?? '').localeCompare(String(a.series_date ?? ''))).map((row: any) => { const outcome = getSeriesOutcome(row.matches ?? [], row); return <Link key={row.series_id} href={`/matches/${row.series_id}`} className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-800 bg-[#111] p-4 text-white no-underline hover:border-purple-800 sm:flex-row sm:items-center"><div><div className="text-xs text-neutral-600">{formatPublicDate(row.series_date)} · {row.teams?.format} · {phaseLabel(row.competition_phase)}</div><div className="mt-1 font-bold">{row.teams?.name} vs {row.opponent_name}</div></div><SeriesResultBadge result={outcome.result} wins={outcome.wins} losses={outcome.losses} isForfeit={outcome.forfeits > 0} /></Link>})}</div> : <EmptyState title="No canonical series available" description="The archive remains empty rather than presenting estimated results." />}
    </section>

    <section id="awards" className="mt-14 scroll-mt-28">
      <SectionHeader eyebrow="Permanent recognition" title="Season Awards" description="Only reviewed and approved awards are published. Statistical leaders do not automatically become subjective award winners." />
      {awards.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{awards.map((award: any) => <article key={award.award_id} className="rounded-2xl border border-purple-900/60 bg-purple-950/15 p-5"><div className="text-xs font-black uppercase text-amber-400">{award.award_type.replaceAll('_', ' ')}</div><h3 className="mt-2 text-xl font-black text-white">{award.title}</h3><div className="mt-3 text-purple-300">{award.recipient_name}</div><div className="mt-2 text-xs text-neutral-600">Selected by {award.selection_method}</div></article>)}</div> : <EmptyState title="Awards have not been published" description="The awards framework is ready, but no winner will be invented or published without approval." />}
    </section>
  </main>
}

function buildTeamResults(series: any[]) {
  const teams = new Map<string, any>()
  for (const row of series) {
    const id = Number(row.flop_reset_team_id)
    if (!Number.isFinite(id)) continue
    const competitionId = Number(row.competition_id)
    const key = `${competitionId}:${id}`
    const outcome = getSeriesOutcome(row.matches ?? [], row)
    const team = teams.get(key) ?? { id, competitionId, name: row.teams?.name ?? 'Unknown', format: row.teams?.format ?? 'Unknown', seriesWins: 0, seriesLosses: 0, gameWins: 0, gameLosses: 0 }
    if (outcome.won) team.seriesWins += 1
    if (outcome.lost) team.seriesLosses += 1
    team.gameWins += outcome.wins
    team.gameLosses += outcome.losses
    teams.set(key, team)
  }
  return [...teams.values()].sort((a, b) => a.format.localeCompare(b.format) || b.seriesWins - a.seriesWins || a.name.localeCompare(b.name))
}

function buildPlayerLeaders(stats: any[]) {
  const players = new Map<string, any>()
  for (const row of stats) {
    if (row.matches?.is_forfeit) continue
    const name = row.players?.name
    if (!name) continue
    const teamId = Number(row.matches?.teams?.id ?? 0)
    const key = `${row.player_id}:${teamId}`
    const player = players.get(key) ?? { playerId: row.player_id, teamId, name, team: row.matches?.teams?.name ?? 'Unknown', games: 0, goals: 0, assists: 0, saves: 0, score: 0 }
    player.games += 1
    player.goals += Number(row.goals ?? 0)
    player.assists += Number(row.assists ?? 0)
    player.saves += Number(row.saves ?? 0)
    player.score += Number(row.score ?? 0)
    players.set(key, player)
  }
  const sorted = [...players.values()].sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.saves - a.saves || b.score - a.score || a.name.localeCompare(b.name))
  return competitionRanks(sorted, (player) => [player.goals, player.assists, player.saves, player.score].join('|'))
}

function buildBestGames(stats: any[]) {
  return stats.filter((row) => !row.matches?.is_forfeit && getGameOutcome(row.matches).result === 'W')
    .sort((a, b) => Number(b.goals ?? 0) - Number(a.goals ?? 0) || Number(b.score ?? 0) - Number(a.score ?? 0)).slice(0, 6)
    .map((row, index) => ({ key: `${row.matches?.match_id}:${row.player_id}:${index}`, name: row.players?.name ?? 'Unknown', team: row.matches?.teams?.name ?? 'Unknown', format: row.matches?.teams?.format ?? 'Unknown', opponent: row.matches?.opponent_name ?? 'Unknown', date: row.matches?.match_date ?? '', goals: Number(row.goals ?? 0), score: Number(row.score ?? 0) }))
}

async function loadPlayoffBrackets(rawBrackets: any[]) {
  const bracketIds = rawBrackets.map((bracket) => Number(bracket.bracket_id)).filter(Number.isFinite)
  if (!bracketIds.length) return []
  const { data: rawMatches, error } = await supabase.from('playoff_matches').select('*').in('bracket_id', bracketIds).order('match_order')
  if (error) return []
  const seriesIds = [...new Set((rawMatches ?? []).map((match: any) => Number(match.series_id)).filter(Number.isFinite))]
  const scheduleIds = [...new Set((rawMatches ?? []).map((match: any) => Number(match.scheduled_match_id)).filter(Number.isFinite))]
  const [seriesResult, scheduleResult] = await Promise.all([
    seriesIds.length ? supabase.from('series').select('series_id, opponent_name, notes, teams ( name, format ), matches ( * )').in('series_id', seriesIds) : Promise.resolve({ data: [] }),
    scheduleIds.length ? supabase.from('scheduled_matches').select('scheduled_id, opponent_name, starts_at, match_date, teams ( name, format )').in('scheduled_id', scheduleIds) : Promise.resolve({ data: [] }),
  ])
  return normalizePlayoffData(rawBrackets, rawMatches ?? [], new Map((seriesResult.data ?? []).map((row: any) => [Number(row.series_id), row])), new Map((scheduleResult.data ?? []).map((row: any) => [Number(row.scheduled_id), row])))
    .filter((bracket) => bracket.matches.some((match) =>
      !['', 'tbd'].includes(match.teamA.trim().toLowerCase())
      || !['', 'tbd'].includes(match.teamB.trim().toLowerCase())
      || match.scoreA !== null
      || match.scoreB !== null
      || Boolean(match.winner || match.isBye || match.isForfeit || match.seriesId || match.scheduledMatchId || match.nextMatchId || match.loserNextMatchId || match.notes),
    ))
}

function placementSort(a: any, b: any) {
  return String(a.competition_format ?? '').localeCompare(String(b.competition_format ?? '')) || Number(a.final_placement ?? a.regular_season_finish ?? Number.MAX_SAFE_INTEGER) - Number(b.final_placement ?? b.regular_season_finish ?? Number.MAX_SAFE_INTEGER)
}

function ordinal(value: unknown) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) return '—'
  const remainder = number % 100
  const suffix = remainder >= 11 && remainder <= 13 ? 'th' : number % 10 === 1 ? 'st' : number % 10 === 2 ? 'nd' : number % 10 === 3 ? 'rd' : 'th'
  return `${number}${suffix}`
}

function phaseLabel(value: unknown) {
  return String(value ?? 'recorded').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
