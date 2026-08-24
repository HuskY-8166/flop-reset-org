export type ResultCode = 'W' | 'L' | 'T'
export type ForfeitResult = 'win' | 'loss' | null

export type GameLike = {
  flop_reset_score?: number | string | null
  opponent_score?: number | string | null
  is_forfeit?: boolean | null
  forfeit_result?: ForfeitResult | string
  result_override?: ForfeitResult | string
}

export type GameOutcome = {
  result: ResultCode
  won: boolean
  lost: boolean
  tied: boolean
  isForfeit: boolean
  hasExplicitResult: boolean
  displayScore: string
  performanceScore: { for: number; against: number } | null
}

export type SeriesOutcome = {
  result: ResultCode
  won: boolean
  lost: boolean
  tied: boolean
  wins: number
  losses: number
  ties: number
  forfeits: number
  displayRecord: string
}

function finiteNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function explicitForfeitResult(game: GameLike): ForfeitResult {
  const value = game.forfeit_result ?? game.result_override
  if (value === 'win' || value === 'loss') return value
  return null
}

function resultFromScores(game: GameLike): ResultCode {
  const ours = finiteNumber(game.flop_reset_score)
  const theirs = finiteNumber(game.opponent_score)
  if (ours > theirs) return 'W'
  if (ours < theirs) return 'L'
  return 'T'
}

/**
 * Canonical Flop Reset-perspective game result.
 *
 * The legacy database encoded forfeit winners in the score. Until the staged
 * migration is applied, that score is used only as a compatibility fallback.
 * Public score display is always 0–0 for a forfeit and forfeit games never
 * expose a performance score.
 */
export function getGameOutcome(game: GameLike): GameOutcome {
  const isForfeit = Boolean(game.is_forfeit)
  const explicit = explicitForfeitResult(game)
  const result = isForfeit && explicit
    ? explicit === 'win' ? 'W' : 'L'
    : resultFromScores(game)

  return {
    result,
    won: result === 'W',
    lost: result === 'L',
    tied: result === 'T',
    isForfeit,
    hasExplicitResult: explicit !== null,
    displayScore: isForfeit
      ? '0–0'
      : `${finiteNumber(game.flop_reset_score)}–${finiteNumber(game.opponent_score)}`,
    performanceScore: isForfeit
      ? null
      : {
          for: finiteNumber(game.flop_reset_score),
          against: finiteNumber(game.opponent_score),
        },
  }
}

export function getSeriesOutcome(games: GameLike[]): SeriesOutcome {
  let wins = 0
  let losses = 0
  let ties = 0
  let forfeits = 0

  for (const game of games) {
    const outcome = getGameOutcome(game)
    if (outcome.won) wins += 1
    else if (outcome.lost) losses += 1
    else ties += 1
    if (outcome.isForfeit) forfeits += 1
  }

  const result: ResultCode = wins > losses ? 'W' : losses > wins ? 'L' : 'T'

  return {
    result,
    won: result === 'W',
    lost: result === 'L',
    tied: result === 'T',
    wins,
    losses,
    ties,
    forfeits,
    displayRecord: `${wins}–${losses}`,
  }
}

export function getPerformanceScore(game: GameLike) {
  return getGameOutcome(game).performanceScore
}

export function isPerformanceGame(game: GameLike) {
  return !getGameOutcome(game).isForfeit
}

export function formatPublicDate(value: string | null | undefined) {
  if (!value) return 'Date unavailable'
  const datePart = value.slice(0, 10)
  const parsed = new Date(`${datePart}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}
