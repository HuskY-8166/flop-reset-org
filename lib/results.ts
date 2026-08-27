export type ResultCode = 'W' | 'L' | 'T'
export type ForfeitResult = 'win' | 'loss' | null

export type GameLike = {
  flop_reset_score?: number | string | null
  opponent_score?: number | string | null
  is_forfeit?: boolean | null
  forfeit_result?: ForfeitResult | string
  result_override?: ForfeitResult | string
}

export type SeriesResultLike = {
  is_forfeit?: boolean | null
  forfeit_result?: ForfeitResult | string
  result_override?: ForfeitResult | string
  notes?: string | null
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
  playedGames: number
  displayRecord: string
}

function finiteNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function explicitForfeitResult(game: GameLike): ForfeitResult {
  const value = game.forfeit_result ?? game.result_override
  if (value === 'win' || value === 'loss') return value
  return null
}

function resultFromScores(game: GameLike): ResultCode {
  const ours = finiteNumber(game.flop_reset_score)
  const theirs = finiteNumber(game.opponent_score)
  if (ours === null || theirs === null) return 'T'
  if (ours > theirs) return 'W'
  if (ours < theirs) return 'L'
  return 'T'
}

/**
 * True only for a real, scoreable Rocket League game. Administrative series
 * rows (forfeits) and incomplete score rows never belong in game records,
 * games-played totals, or performance aggregates.
 */
export function countsAsPlayedGame(game: GameLike) {
  return !game.is_forfeit &&
    finiteNumber(game.flop_reset_score) !== null &&
    finiteNumber(game.opponent_score) !== null
}

/**
 * Canonical Flop Reset-perspective game result.
 *
 * Forfeit outcomes always come from an explicit result field, never the score.
 * An old ambiguous forfeit without that field remains a tie/unknown state until
 * an operator verifies it. Public score display is always 0–0 and forfeits
 * never expose a performance score.
 */
export function getGameOutcome(game: GameLike): GameOutcome {
  const isForfeit = Boolean(game.is_forfeit)
  const explicit = explicitForfeitResult(game)
  const ours = finiteNumber(game.flop_reset_score)
  const theirs = finiteNumber(game.opponent_score)
  const result = isForfeit
    ? explicit === 'win' ? 'W' : explicit === 'loss' ? 'L' : 'T'
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
      : ours === null || theirs === null ? '—' : `${ours}–${theirs}`,
    performanceScore: isForfeit || ours === null || theirs === null
      ? null
      : {
          for: ours,
          against: theirs,
        },
  }
}

function administrativeForfeitResult(series: SeriesResultLike | null | undefined): ForfeitResult {
  if (!series) return null
  const explicit = series.forfeit_result ?? series.result_override
  if (explicit === 'win' || explicit === 'loss') return explicit

  // Backward-compatible fallback for archived zero-game forfeits that were
  // recorded before the dedicated series columns existed.
  const note = series.notes?.trim().toLocaleLowerCase('en-US') ?? ''
  if (!series.is_forfeit && !note.includes('forfeit')) return null
  if (/forfeit\s+win/.test(note)) return 'win'
  if (/forfeit\s+loss/.test(note)) return 'loss'
  return null
}

export function getSeriesOutcome(
  games: GameLike[],
  series?: SeriesResultLike | null,
): SeriesOutcome {
  let wins = 0
  let losses = 0
  let ties = 0
  let forfeits = 0
  let forfeitWins = 0
  let forfeitLosses = 0

  for (const game of games) {
    const outcome = getGameOutcome(game)
    if (outcome.isForfeit) {
      forfeits += 1
      if (outcome.won) forfeitWins += 1
      else if (outcome.lost) forfeitLosses += 1
      continue
    }
    if (!countsAsPlayedGame(game)) continue
    if (outcome.won) wins += 1
    else if (outcome.lost) losses += 1
    else ties += 1
  }

  const administrativeForfeit = administrativeForfeitResult(series)
  if (forfeits === 0 && administrativeForfeit) {
    forfeits = 1
    if (administrativeForfeit === 'win') forfeitWins = 1
    else forfeitLosses = 1
  }

  const result: ResultCode = forfeitWins > forfeitLosses
    ? 'W'
    : forfeitLosses > forfeitWins
      ? 'L'
      : wins > losses
        ? 'W'
        : losses > wins
          ? 'L'
          : 'T'

  return {
    result,
    won: result === 'W',
    lost: result === 'L',
    tied: result === 'T',
    wins,
    losses,
    ties,
    forfeits,
    playedGames: wins + losses + ties,
    displayRecord: `${wins}–${losses}`,
  }
}

export function getPerformanceScore(game: GameLike) {
  return getGameOutcome(game).performanceScore
}

export function isPerformanceGame(game: GameLike) {
  return countsAsPlayedGame(game)
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
