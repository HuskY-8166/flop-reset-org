export type BallchasingFileType = 'players' | 'players-games' | 'unknown'

export type TrackingCoverage = {
  total: number
  basic: number
  movement: number
  positioning: number
  zeroBoost: number
}

export type PlayerSummaryRow = {
  teamName: string
  playerName: string
  games: number
  basic: {
    goals: number | null
    assists: number | null
    saves: number | null
    shots: number | null
    score: number | null
    bpm: number | null
    avgSpeed: number | null
    demosInflicted: number | null
    demosTaken: number | null
    boostCollected: number | null
    boostStolen: number | null
  }
  tracking: Record<string, number | null>
}

const BASIC_HEADERS = ['team name', 'player name', 'games', 'goals', 'assists', 'saves', 'shots', 'score']
const MOVEMENT_HEADERS = [
  'avg speed per game',
  'time slow speed per game',
  'time boost speed per game',
  'time supersonic speed per game',
  'time on ground per game',
  'time low in air per game',
  'time high in air per game',
]
const POSITIONING_HEADERS = [
  'time most back per game',
  'time most forward per game',
  'time in front of ball per game',
  'time behind ball per game',
  'time defensive half per game',
  'time offensive half per game',
  'time defensive third per game',
  'time neutral third per game',
  'time offensive third per game',
  'avg distance to ball per game',
  'avg distance to ball has possession per game',
  'avg distance to ball no possession per game',
  'avg distance to team mates per game',
]
const ZERO_BOOST_HEADERS = ['0 boost time per game']

export function normalizeBallchasingHeader(value: string) {
  return value.replace(/^\uFEFF/, '').trim().toLocaleLowerCase('en-US')
}

export function normalizeBallchasingRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeBallchasingHeader(key), value]),
  )
}

export function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function ratioPercent(numerator: number | null, denominatorParts: Array<number | null>) {
  if (numerator === null || denominatorParts.some((value) => value === null)) return null
  const denominator = denominatorParts.reduce<number>((sum, value) => sum + Number(value), 0)
  return denominator > 0 ? (numerator / denominator) * 100 : null
}

export function detectBallchasingFile(headers: string[]) {
  const normalized = new Set(headers.map(normalizeBallchasingHeader))
  const type: BallchasingFileType = normalized.has('replay id') && normalized.has('player name')
    ? 'players-games'
    : normalized.has('player name') && normalized.has('games') && normalized.has('team name')
      ? 'players'
      : 'unknown'

  const hasAll = (family: string[]) => family.every((header) => normalized.has(header))
  const hasAny = (family: string[]) => family.some((header) => normalized.has(header))

  return {
    type,
    headers: [...normalized],
    basic: hasAll(BASIC_HEADERS),
    movement: hasAny(MOVEMENT_HEADERS),
    positioning: hasAny(POSITIONING_HEADERS),
    zeroBoost: hasAny(ZERO_BOOST_HEADERS) || normalized.has('0 boost time'),
    missingBasicHeaders: BASIC_HEADERS.filter((header) => !normalized.has(header)),
  }
}

/**
 * Maps one aggregate Ballchasing players.csv row. Percentage fields are
 * reconstructed only from same-unit time families in that row; raw percent
 * values are never divided by 100 a second time.
 *
 * The result is a series/player summary and must not be written directly into
 * per-game match_player_stats rows because players.csv has no replay identity.
 */
export function mapPlayersCsvRow(input: Record<string, unknown>): PlayerSummaryRow {
  const row = normalizeBallchasingRow(input)
  const n = (key: string) => numberOrNull(row[key])

  const slow = n('time slow speed per game')
  const boost = n('time boost speed per game')
  const supersonic = n('time supersonic speed per game')
  const ground = n('time on ground per game')
  const lowAir = n('time low in air per game')
  const highAir = n('time high in air per game')
  const mostBack = n('time most back per game')
  const mostForward = n('time most forward per game')
  const inFront = n('time in front of ball per game')
  const behind = n('time behind ball per game')
  const defensiveHalf = n('time defensive half per game')
  const offensiveHalf = n('time offensive half per game')
  const defensiveThird = n('time defensive third per game')
  const neutralThird = n('time neutral third per game')
  const offensiveThird = n('time offensive third per game')
  const zeroBoostTime = n('0 boost time per game')
  const movementTime = [ground, lowAir, highAir]

  return {
    teamName: text(row['team name']),
    playerName: text(row['player name']),
    games: Math.max(0, Math.trunc(n('games') ?? 0)),
    basic: {
      goals: n('goals'),
      assists: n('assists'),
      saves: n('saves'),
      shots: n('shots'),
      score: n('score'),
      bpm: n('bpm per game'),
      avgSpeed: n('avg speed per game'),
      demosInflicted: n('demos inflicted per game'),
      demosTaken: n('demos taken per game'),
      boostCollected: n('amount collected per game'),
      boostStolen: n('amount stolen per game'),
    },
    tracking: {
      percentage_supersonic_speed: ratioPercent(supersonic, [slow, boost, supersonic]),
      percentage_on_ground: ratioPercent(ground, movementTime),
      percentage_low_air: ratioPercent(lowAir, movementTime),
      percentage_high_air: ratioPercent(highAir, movementTime),
      percentage_most_back: ratioPercent(mostBack, movementTime),
      percentage_most_forward: ratioPercent(mostForward, movementTime),
      percentage_behind_ball: ratioPercent(behind, [behind, inFront]),
      percentage_in_front_of_ball: ratioPercent(inFront, [behind, inFront]),
      percentage_defensive_half: ratioPercent(defensiveHalf, [defensiveHalf, offensiveHalf]),
      percentage_offensive_half: ratioPercent(offensiveHalf, [defensiveHalf, offensiveHalf]),
      percentage_defensive_third: ratioPercent(defensiveThird, [defensiveThird, neutralThird, offensiveThird]),
      percentage_neutral_third: ratioPercent(neutralThird, [defensiveThird, neutralThird, offensiveThird]),
      percentage_offensive_third: ratioPercent(offensiveThird, [defensiveThird, neutralThird, offensiveThird]),
      avg_distance_to_ball: n('avg distance to ball per game'),
      avg_distance_to_ball_has_possession: n('avg distance to ball has possession per game'),
      avg_distance_to_ball_no_possession: n('avg distance to ball no possession per game'),
      avg_distance_to_teammates: n('avg distance to team mates per game') ?? n('avg distance to teammates per game'),
      zero_boost_pct: ratioPercent(zeroBoostTime, movementTime),
    },
  }
}

function hasAny(values: Array<number | null>) {
  return values.some((value) => value !== null)
}

export function getPlayersCsvCoverage(rows: PlayerSummaryRow[]): TrackingCoverage {
  const coverage: TrackingCoverage = { total: 0, basic: 0, movement: 0, positioning: 0, zeroBoost: 0 }
  for (const row of rows) {
    const weight = row.games
    coverage.total += weight
    if (hasAny(Object.values(row.basic))) coverage.basic += weight
    if (hasAny([
      row.tracking.percentage_supersonic_speed,
      row.tracking.percentage_on_ground,
      row.tracking.percentage_low_air,
      row.tracking.percentage_high_air,
    ])) coverage.movement += weight
    if (hasAny([
      row.tracking.percentage_most_back,
      row.tracking.percentage_defensive_half,
      row.tracking.percentage_defensive_third,
      row.tracking.avg_distance_to_ball,
    ])) coverage.positioning += weight
    if (row.tracking.zero_boost_pct !== null) coverage.zeroBoost += weight
  }
  return coverage
}

/** Keeps stored values when an incoming export omitted a field; real zeros remain updates. */
export function nonNullUpdate(values: Record<string, number | null | undefined>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== null && value !== undefined),
  ) as Record<string, number>
}

export type BasicStatsLike = {
  goals?: number | null
  assists?: number | null
  saves?: number | null
  shots?: number | null
  score?: number | null
}

export function getBasicStatConflicts(stored: BasicStatsLike, incoming: BasicStatsLike) {
  return (['goals', 'assists', 'saves', 'shots', 'score'] as const).flatMap((field) => {
    const next = incoming[field]
    if (next === null || next === undefined) return []
    const current = stored[field]
    return Number(current ?? 0) === Number(next)
      ? []
      : [{ field, stored: current ?? null, incoming: next }]
  })
}

export const PLAYERS_CSV_MAPPING = {
  'bpm per game': 'bpm',
  'avg speed per game': 'avg_speed',
  'amount collected per game': 'boost_collected (aggregate preview only)',
  'amount stolen per game': 'boost_stolen (aggregate preview only)',
  'demos inflicted per game': 'demos_inflicted (aggregate preview only)',
  'demos taken per game': 'demos_taken (aggregate preview only)',
  'time supersonic speed per game': 'percentage_supersonic_speed (derived percent)',
  'time on ground per game': 'percentage_on_ground (derived percent)',
  'time low in air per game': 'percentage_low_air (derived percent)',
  'time high in air per game': 'percentage_high_air (derived percent)',
  'time most back per game': 'percentage_most_back (derived percent)',
  'time most forward per game': 'percentage_most_forward (derived percent)',
  'time behind ball per game': 'percentage_behind_ball (derived percent)',
  'time in front of ball per game': 'percentage_in_front_of_ball (derived percent)',
  'time defensive half per game': 'percentage_defensive_half (derived percent)',
  'time offensive half per game': 'percentage_offensive_half (derived percent)',
  'time defensive third per game': 'percentage_defensive_third (derived percent)',
  'time neutral third per game': 'percentage_neutral_third (derived percent)',
  'time offensive third per game': 'percentage_offensive_third (derived percent)',
  'avg distance to ball per game': 'avg_distance_to_ball',
  'avg distance to ball has possession per game': 'avg_distance_to_ball_has_possession',
  'avg distance to ball no possession per game': 'avg_distance_to_ball_no_possession',
  'avg distance to team mates per game': 'avg_distance_to_teammates',
  '0 boost time per game': 'zero_boost_pct (derived percent)',
} as const
