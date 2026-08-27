/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSeriesOutcome } from '@/lib/results'
import { getPlayoffRoundOrder, getPlayoffTierNumber } from '@/lib/playoffAdmin'

export const FLOP_RESET_PLAYOFF_TEAMS = ['Fracture', 'Frantic', 'Frameshift'] as const

export type PublicPlayoffMatch = {
  id: number
  bracketId: number
  bracketName: string
  tier: string
  roundName: string
  roundOrder: number
  matchOrder: number
  teamA: string
  teamB: string
  scoreA: number | null
  scoreB: number | null
  winner: string | null
  status: string
  isBye: boolean
  isForfeit: boolean
  resultLabel: string | null
  seriesId: number | null
  scheduledMatchId: number | null
  nextMatchId: number | null
  loserNextMatchId: number | null
  startsAt: string | null
  notes: string | null
}

export type PublicPlayoffBracket = {
  id: number
  name: string
  tier: string
  status: string
  matches: PublicPlayoffMatch[]
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export function shortFlopTeam(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized.includes('frameshift')) return 'Frameshift'
  if (normalized.includes('frantic')) return 'Frantic'
  if (normalized.includes('fracture')) return 'Fracture'
  return null
}

export function isFlopResetTeam(value: string | null | undefined) {
  return shortFlopTeam(value) !== null
}

export function playoffRoundOrder(value: string | null | undefined) {
  return getPlayoffRoundOrder(value) ?? 99
}

export function normalizePlayoffData(
  rawBrackets: any[],
  rawMatches: any[],
  linkedSeries: Map<number, any>,
  linkedSchedule: Map<number, any>
): PublicPlayoffBracket[] {
  return rawBrackets.map((bracket) => {
    const bracketId = Number(bracket.bracket_id ?? bracket.id)
    const bracketTierNumber = getPlayoffTierNumber(bracket.tier, bracket.name)
    const bracketTier = bracketTierNumber === null ? 'Tier TBD' : `Tier ${bracketTierNumber}`
    const bracketMatches = rawMatches
      .filter((match) => Number(match.bracket_id) === bracketId)
      .map((match): PublicPlayoffMatch => {
        const seriesId = numberOrNull(match.series_id)
        const scheduledMatchId = numberOrNull(match.scheduled_match_id)
        const series = seriesId ? linkedSeries.get(seriesId) : null
        const schedule = scheduledMatchId ? linkedSchedule.get(scheduledMatchId) : null
        const seriesTeam = series?.teams?.name
        const seriesOpponent = series?.opponent_name
        const scheduledTeam = schedule?.teams?.name
        const scheduledOpponent = schedule?.opponent_name
        const teamA = stringValue(
          match.team_a_name,
          match.participant_a_name,
          match.home_team_name,
          match.slot_a_name,
          seriesTeam,
          scheduledTeam,
          match.is_bye ? match.winner_name : null
        ) || 'TBD'
        const teamB = stringValue(
          match.team_b_name,
          match.participant_b_name,
          match.away_team_name,
          match.slot_b_name,
          seriesOpponent,
          scheduledOpponent
        ) || (match.is_bye ? 'BYE' : 'TBD')

        let scoreA = numberOrNull(match.score_a)
        let scoreB = numberOrNull(match.score_b)
        let winner = stringValue(match.winner_name) || null
        let resultLabel: string | null = null

        if (series) {
          const outcome = getSeriesOutcome(series.matches ?? [], series)
          const flopIsA = shortFlopTeam(teamA) === shortFlopTeam(seriesTeam)
          const forfeit = outcome.forfeits > 0
          scoreA = forfeit ? 0 : flopIsA ? outcome.wins : outcome.losses
          scoreB = forfeit ? 0 : flopIsA ? outcome.losses : outcome.wins
          winner = outcome.won ? seriesTeam : outcome.lost ? seriesOpponent : null
          resultLabel = forfeit ? `${outcome.result} · FORFEIT · 0–0` : `${outcome.result} · ${outcome.displayRecord}`
        } else if (match.is_bye) {
          winner = teamA !== 'TBD' ? teamA : teamB !== 'BYE' ? teamB : null
          scoreA = null
          scoreB = null
          resultLabel = 'BYE · ADVANCES'
        } else if (match.is_forfeit) {
          scoreA = 0
          scoreB = 0
          resultLabel = winner ? 'FORFEIT · 0–0' : 'FORFEIT · WINNER TBD'
        } else if (winner && scoreA !== null && scoreB !== null) {
          resultLabel = `${scoreA}–${scoreB}`
        }

        return {
          id: Number(match.playoff_match_id ?? match.match_id ?? match.id),
          bracketId,
          bracketName: stringValue(bracket.name) || `Tier ${bracket.tier ?? ''}`.trim(),
          tier: bracketTier,
          roundName: stringValue(match.round_name, match.round) || 'Stage TBD',
          roundOrder: playoffRoundOrder(match.round_name ?? match.round),
          matchOrder: Number(match.match_order ?? match.position ?? 0),
          teamA,
          teamB,
          scoreA,
          scoreB,
          winner,
          status: stringValue(match.status) || (series ? 'completed' : schedule ? 'scheduled' : 'pending'),
          isBye: Boolean(match.is_bye),
          isForfeit: Boolean(match.is_forfeit),
          resultLabel,
          seriesId,
          scheduledMatchId,
          nextMatchId: numberOrNull(match.next_match_id),
          loserNextMatchId: numberOrNull(match.loser_next_match_id),
          startsAt: stringValue(match.scheduled_at, match.starts_at, schedule?.starts_at, schedule?.match_date) || null,
          notes: stringValue(match.notes) || null,
        }
      })
      .sort((a, b) => a.roundOrder - b.roundOrder || a.matchOrder - b.matchOrder)

    return {
      id: bracketId,
      name: stringValue(bracket.name) || `${bracket.tier ?? 'Playoff'} Bracket`,
      tier: bracketTier,
      status: stringValue(bracket.status) || 'active',
      matches: bracketMatches,
    }
  })
}

export function playoffTeamState(team: string, brackets: PublicPlayoffBracket[]) {
  const appearances = brackets
    .flatMap((bracket) => bracket.matches)
    .filter((match) => shortFlopTeam(match.teamA) === team || shortFlopTeam(match.teamB) === team)
    .sort((a, b) => b.roundOrder - a.roundOrder || b.matchOrder - a.matchOrder)
  const latest = appearances[0]

  if (!latest) return { team, tier: 'Awaiting verified seed', round: 'Not seeded', opponent: 'TBD', status: 'Awaiting bracket data', startsAt: null }
  const opponent = shortFlopTeam(latest.teamA) === team ? latest.teamB : latest.teamA
  const completed = latest.status === 'completed' || Boolean(latest.winner)
  const won = shortFlopTeam(latest.winner) === team
  const isFinal = latest.roundName.toLowerCase().includes('final') && !latest.roundName.toLowerCase().includes('semi')
  const status = latest.isBye
    ? 'Advanced by BYE'
    : !completed
      ? latest.status === 'scheduled' ? 'Scheduled' : 'Alive'
      : won && isFinal
        ? 'Champion'
        : won
          ? 'Advanced'
          : 'Eliminated'

  return { team, tier: latest.tier, round: latest.roundName, opponent, status, startsAt: latest.startsAt }
}
