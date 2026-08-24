// lib/processSkills.ts
//
// Flop Reset Process Skills engine
//
// Handles:
// - Process Skills calculations
// - 20% eligibility rule
// - Missing-data awareness
// - Medal rankings and ties
// - Rate stats
// - Medal table

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ProcessSkillKey =
  | 'demoEfficiency'
  | 'shotQuality'
  | 'boostStealRate'
  | 'supersonicPct'
  | 'bpm'
  | 'positioningDepth'
  | 'avgSpeed'
  | 'airTimePct'
  | 'zeroBoostPct'

export type ProcessSkillDirection =
  | 'higher'
  | 'lower'

export type ProcessSkillAvailability =
  Record<ProcessSkillKey, boolean>

export type ProcessPlayer = {
  playerId: number
  name: string
  team: string
  format: string

  games: number

  goals: number
  assists: number
  saves: number
  shots: number

  bpm: number
  avgSpeed: number

  demosInflicted: number
  demosTaken: number

  boostCollected: number
  boostStolen: number

  supersonicPct: number
  groundPct: number
  lowAirPct: number
  highAirPct: number

  defensiveThirdPct: number
  neutralThirdPct: number
  offensiveThirdPct: number

  mostBackPct: number
  mostForwardPct: number
  behindBallPct: number
  inFrontOfBallPct: number

  defensiveHalfPct: number
  offensiveHalfPct: number

  avgDistanceToBall: number
  avgDistanceToBallHasPossession: number
  avgDistanceToBallNoPossession: number
  avgDistanceToTeammates: number

  zeroBoostPct: number

  /**
   * Lets the Stats page tell us whether a stat
   * actually exists for this player.
   *
   * This is critical because:
   *
   * NULL / never collected
   *
   * is NOT the same thing as:
   *
   * a legitimate value of 0.
   */
  dataAvailability?: Partial<ProcessSkillAvailability>
}

export type ProcessSkillResult = {
  playerId: number
  name: string
  team: string
  format: string
  games: number

  eligible: boolean

  availableSkills: ProcessSkillAvailability

  demoEfficiency: number
  shotQuality: number
  boostStealRate: number
  supersonicPct: number
  bpm: number
  positioningDepth: number
  avgSpeed: number
  airTimePct: number
  zeroBoostPct: number

  goalsPerGame: number
  assistsPerGame: number
  savesPerGame: number
}

export type RankedProcessPlayer =
  ProcessSkillResult & {
    rank: number
    medal:
      | '🥇'
      | '🥈'
      | '🥉'
      | ''
  }

export type ProcessSkillDefinition = {
  key: ProcessSkillKey
  label: string
  shortLabel: string
  description: string
  direction: ProcessSkillDirection
  suffix: string
  decimals: number
}

// -----------------------------------------------------------------------------
// Definitions
// -----------------------------------------------------------------------------

export const PROCESS_SKILLS: ProcessSkillDefinition[] =
  [
    {
      key: 'demoEfficiency',
      label: 'Demo Efficiency %',
      shortLabel: 'Demo Eff.',
      description:
        'Share of total demo interactions won by the player.',
      direction: 'higher',
      suffix: '%',
      decimals: 1,
    },

    {
      key: 'shotQuality',
      label: 'Shot Quality %',
      shortLabel: 'Shot Quality',
      description:
        'Goals divided by shots. Measures shooting conversion efficiency.',
      direction: 'higher',
      suffix: '%',
      decimals: 1,
    },

    {
      key: 'boostStealRate',
      label: 'Boost Steal Rate %',
      shortLabel: 'Boost Steal',
      description:
        'Stolen boost as a percentage of collected plus stolen boost.',
      direction: 'higher',
      suffix: '%',
      decimals: 1,
    },

    {
      key: 'supersonicPct',
      label: 'Supersonic %',
      shortLabel: 'Supersonic',
      description:
        'Percentage of tracked movement time spent at supersonic speed.',
      direction: 'higher',
      suffix: '%',
      decimals: 1,
    },

    {
      key: 'bpm',
      label: 'BPM',
      shortLabel: 'BPM',
      description:
        'Boost used per minute.',
      direction: 'higher',
      suffix: '',
      decimals: 1,
    },

    {
      key: 'positioningDepth',
      label: 'Positioning Depth',
      shortLabel: 'Positioning',
      description:
        'Composite measure describing how deep a player tends to position.',
      direction: 'higher',
      suffix: '',
      decimals: 1,
    },

    {
      key: 'avgSpeed',
      label: 'Avg Speed',
      shortLabel: 'Speed',
      description:
        'Average movement speed across tracked games.',
      direction: 'higher',
      suffix: '',
      decimals: 0,
    },

    {
      key: 'airTimePct',
      label: 'Air Time %',
      shortLabel: 'Air Time',
      description:
        'Combined percentage of time spent low and high in the air.',
      direction: 'higher',
      suffix: '%',
      decimals: 1,
    },

    {
      key: 'zeroBoostPct',
      label: '% Zero Boost',
      shortLabel: 'Zero Boost',
      description:
        'Percentage of tracked time spent at zero boost. Lower is better.',
      direction: 'lower',
      suffix: '%',
      decimals: 1,
    },
  ]

// -----------------------------------------------------------------------------
// General helpers
// -----------------------------------------------------------------------------

function safeNumber(
  value: unknown
): number {
  const parsed =
    Number(value)

  if (
    !Number.isFinite(parsed)
  ) {
    return 0
  }

  return parsed
}

function safeDivide(
  numerator: number,
  denominator: number
): number {
  if (
    !denominator
  ) {
    return 0
  }

  return (
    numerator /
    denominator
  )
}

export function roundTo(
  value: number,
  decimals = 1
): number {
  const multiplier =
    10 ** decimals

  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
        multiplier
    ) /
    multiplier
  )
}

// -----------------------------------------------------------------------------
// Process Skills formulas
// -----------------------------------------------------------------------------

/**
 * Demo Efficiency
 *
 * Previous formula:
 *
 * inflicted / taken
 *
 * That could create confusing values like 23.50.
 *
 * New formula:
 *
 * inflicted / (inflicted + taken) * 100
 *
 * Example:
 *
 * 47 inflicted
 * 2 taken
 *
 * = 95.9%
 */
export function calculateDemoEfficiency(
  demosInflicted: number,
  demosTaken: number
): number {
  const inflicted =
    safeNumber(
      demosInflicted
    )

  const taken =
    safeNumber(
      demosTaken
    )

  const total =
    inflicted + taken

  return roundTo(
    safeDivide(
      inflicted,
      total
    ) * 100,
    1
  )
}

export function calculateShotQuality(
  goals: number,
  shots: number
): number {
  return roundTo(
    safeDivide(
      safeNumber(goals),
      safeNumber(shots)
    ) * 100,
    1
  )
}

/**
 * Boost Steal Rate
 *
 * stolen / (collected + stolen) * 100
 *
 * TODO: Verify against the exact Ballchasing export semantics before changing
 * this formula. If `amount collected` already includes stolen boost, adding
 * `stolen` again would double-count it. The existing formula is intentionally
 * preserved until project-local or authoritative schema documentation proves
 * which interpretation is correct.
 */
export function calculateBoostStealRate(
  boostStolen: number,
  boostCollected: number
): number {
  const stolen =
    safeNumber(
      boostStolen
    )

  const collected =
    safeNumber(
      boostCollected
    )

  const total =
    stolen +
    collected

  return roundTo(
    safeDivide(
      stolen,
      total
    ) * 100,
    1
  )
}

export function calculateAirTimePct(
  lowAirPct: number,
  highAirPct: number
): number {
  return roundTo(
    safeNumber(
      lowAirPct
    ) +
      safeNumber(
        highAirPct
      ),
    1
  )
}

/**
 * Positioning Depth
 *
 * This describes how deep / support-oriented
 * a player's positioning tends to be.
 *
 * It does NOT mean that higher is inherently
 * better at Rocket League.
 *
 * Current weighting:
 *
 * 40% defensive third
 * 25% behind ball
 * 20% most back
 * 15% defensive half
 */
export function calculatePositioningDepth(
  defensiveThirdPct: number,
  behindBallPct: number,
  mostBackPct: number,
  defensiveHalfPct: number
): number {
  const defensiveThird =
    safeNumber(
      defensiveThirdPct
    )

  const behindBall =
    safeNumber(
      behindBallPct
    )

  const mostBack =
    safeNumber(
      mostBackPct
    )

  const defensiveHalf =
    safeNumber(
      defensiveHalfPct
    )

  const score =
    defensiveThird * 0.4 +
    behindBall * 0.25 +
    mostBack * 0.2 +
    defensiveHalf * 0.15

  return roundTo(
    score,
    1
  )
}

// -----------------------------------------------------------------------------
// Availability
// -----------------------------------------------------------------------------

/**
 * Detailed Process Skills did not exist for
 * older imports.
 *
 * Therefore we MUST NOT interpret a missing
 * percentage as a real value of zero.
 */
function determineAvailability(
  player: ProcessPlayer
): ProcessSkillAvailability {
  const supplied =
    player.dataAvailability

  return {
    /**
     * These metrics existed in the older data
     * model and can safely participate unless
     * explicitly marked unavailable.
     */

    demoEfficiency:
      supplied
        ?.demoEfficiency ??
      player.games > 0,

    shotQuality:
      supplied
        ?.shotQuality ??
      player.games > 0,

    boostStealRate:
      supplied
        ?.boostStealRate ??
      player.games > 0,

    bpm:
      supplied?.bpm ??
      player.games > 0,

    avgSpeed:
      supplied
        ?.avgSpeed ??
      player.games > 0,

    /**
     * These metrics depend on the NEW detailed
     * players-games imports.
     *
     * Default them to unavailable unless the
     * Stats page explicitly tells us data exists.
     *
     * This is what prevents historical NULL rows
     * from becoming fake 0.0 gold medals.
     */

    supersonicPct:
      supplied
        ?.supersonicPct ??
      false,

    positioningDepth:
      supplied
        ?.positioningDepth ??
      false,

    airTimePct:
      supplied
        ?.airTimePct ??
      false,

    zeroBoostPct:
      supplied
        ?.zeroBoostPct ??
      false,
  }
}

export function isProcessSkillAvailable(
  player: ProcessSkillResult,
  skill: ProcessSkillKey
): boolean {
  return Boolean(
    player.availableSkills[
      skill
    ]
  )
}

// -----------------------------------------------------------------------------
// Player calculation
// -----------------------------------------------------------------------------

export function calculateProcessSkills(
  player: ProcessPlayer,
  eligibilityThreshold: number
): ProcessSkillResult {
  const games =
    safeNumber(
      player.games
    )

  const availableSkills =
    determineAvailability(
      player
    )

  return {
    playerId:
      player.playerId,

    name:
      player.name,

    team:
      player.team,

    format:
      player.format,

    games,

    eligible:
      games >=
      eligibilityThreshold,

    availableSkills,

    demoEfficiency:
      calculateDemoEfficiency(
        player.demosInflicted,
        player.demosTaken
      ),

    shotQuality:
      calculateShotQuality(
        player.goals,
        player.shots
      ),

    boostStealRate:
      calculateBoostStealRate(
        player.boostStolen,
        player.boostCollected
      ),

    supersonicPct:
      roundTo(
        safeNumber(
          player.supersonicPct
        ),
        1
      ),

    bpm:
      roundTo(
        safeNumber(
          player.bpm
        ),
        1
      ),

    positioningDepth:
      calculatePositioningDepth(
        player.defensiveThirdPct,
        player.behindBallPct,
        player.mostBackPct,
        player.defensiveHalfPct
      ),

    avgSpeed:
      roundTo(
        safeNumber(
          player.avgSpeed
        ),
        0
      ),

    airTimePct:
      calculateAirTimePct(
        player.lowAirPct,
        player.highAirPct
      ),

    zeroBoostPct:
      roundTo(
        safeNumber(
          player.zeroBoostPct
        ),
        1
      ),

    goalsPerGame:
      roundTo(
        safeDivide(
          player.goals,
          games
        ),
        2
      ),

    assistsPerGame:
      roundTo(
        safeDivide(
          player.assists,
          games
        ),
        2
      ),

    savesPerGame:
      roundTo(
        safeDivide(
          player.saves,
          games
        ),
        2
      ),
  }
}

// -----------------------------------------------------------------------------
// Eligibility
// -----------------------------------------------------------------------------

/**
 * Flop Reset eligibility:
 *
 * A player needs at least 20% of the games
 * played by the most-active player in the
 * currently filtered dataset.
 */
export function getEligibilityThreshold(
  players: Pick<
    ProcessPlayer,
    'games'
  >[]
): number {
  if (
    players.length === 0
  ) {
    return 0
  }

  const highestGames =
    Math.max(
      ...players.map(
        (player) =>
          safeNumber(
            player.games
          )
      )
    )

  if (
    highestGames <= 0
  ) {
    return 0
  }

  return Math.max(
    1,
    Math.ceil(
      highestGames *
        0.2
    )
  )
}

export function buildProcessSkillResults(
  players: ProcessPlayer[]
): ProcessSkillResult[] {
  const threshold =
    getEligibilityThreshold(
      players
    )

  return players.map(
    (player) =>
      calculateProcessSkills(
        player,
        threshold
      )
  )
}

// -----------------------------------------------------------------------------
// Medal helpers
// -----------------------------------------------------------------------------

export function medalForRank(
  rank: number
):
  | '🥇'
  | '🥈'
  | '🥉'
  | '' {
  if (
    rank === 1
  ) {
    return '🥇'
  }

  if (
    rank === 2
  ) {
    return '🥈'
  }

  if (
    rank === 3
  ) {
    return '🥉'
  }

  return ''
}

/**
 * Competition-style ranking:
 *
 * 1
 * 2
 * 2
 * 4
 *
 * Missing data is excluded BEFORE ranking.
 */
export function rankProcessSkill(
  players: ProcessSkillResult[],
  skill: ProcessSkillKey
): RankedProcessPlayer[] {
  const definition =
    PROCESS_SKILLS.find(
      (item) =>
        item.key ===
        skill
    )

  if (
    !definition
  ) {
    return []
  }

  /**
   * Critical fix:
   *
   * Player must:
   *
   * 1. Meet GP eligibility
   * 2. Actually have data for this skill
   */
  const eligible =
    players.filter(
      (player) =>
        player.eligible &&
        isProcessSkillAvailable(
          player,
          skill
        )
    )

  const sorted =
    [...eligible].sort(
      (a, b) => {
        const aValue =
          safeNumber(
            a[skill]
          )

        const bValue =
          safeNumber(
            b[skill]
          )

        if (
          definition.direction ===
          'lower'
        ) {
          return (
            aValue -
            bValue
          )
        }

        return (
          bValue -
          aValue
        )
      }
    )

  let previousValue:
    | number
    | null = null

  let previousRank = 0

  return sorted.map(
    (
      player,
      index
    ) => {
      const value =
        safeNumber(
          player[skill]
        )

      let rank: number

      if (
        previousValue !==
          null &&
        value ===
          previousValue
      ) {
        rank =
          previousRank
      } else {
        rank =
          index + 1
      }

      previousValue =
        value

      previousRank =
        rank

      return {
        ...player,

        rank,

        medal:
          medalForRank(
            rank
          ),
      }
    }
  )
}

/**
 * Return all players whose competition rank
 * is 1, 2, or 3.
 *
 * Because ties are preserved, this can return
 * more than three players.
 */
export function getMedalists(
  players: ProcessSkillResult[],
  skill: ProcessSkillKey
): RankedProcessPlayer[] {
  return rankProcessSkill(
    players,
    skill
  ).filter(
    (player) =>
      player.rank <= 3
  )
}

// -----------------------------------------------------------------------------
// Ineligible players
// -----------------------------------------------------------------------------

export function getIneligiblePlayers(
  players: ProcessSkillResult[]
): ProcessSkillResult[] {
  return players
    .filter(
      (player) =>
        !player.eligible
    )
    .sort(
      (a, b) =>
        b.games -
        a.games
    )
}

// -----------------------------------------------------------------------------
// Rate Stats
// -----------------------------------------------------------------------------

export type RateStatKey =
  | 'goalsPerGame'
  | 'assistsPerGame'
  | 'savesPerGame'

export type RateStatDefinition = {
  key: RateStatKey
  label: string
  shortLabel: string
}

export const RATE_STATS: RateStatDefinition[] =
  [
    {
      key: 'goalsPerGame',
      label:
        'Goals Per Game',
      shortLabel:
        'G/GP',
    },

    {
      key: 'assistsPerGame',
      label:
        'Assists Per Game',
      shortLabel:
        'A/GP',
    },

    {
      key: 'savesPerGame',
      label:
        'Saves Per Game',
      shortLabel:
        'SV/GP',
    },
  ]

export function rankRateStat(
  players: ProcessSkillResult[],
  stat: RateStatKey
): RankedProcessPlayer[] {
  const eligible =
    players.filter(
      (player) =>
        player.eligible
    )

  const sorted =
    [...eligible].sort(
      (a, b) =>
        safeNumber(
          b[stat]
        ) -
        safeNumber(
          a[stat]
        )
    )

  let previousValue:
    | number
    | null = null

  let previousRank = 0

  return sorted.map(
    (
      player,
      index
    ) => {
      const value =
        safeNumber(
          player[stat]
        )

      let rank: number

      if (
        previousValue !==
          null &&
        value ===
          previousValue
      ) {
        rank =
          previousRank
      } else {
        rank =
          index + 1
      }

      previousValue =
        value

      previousRank =
        rank

      return {
        ...player,

        rank,

        medal:
          medalForRank(
            rank
          ),
      }
    }
  )
}

export function getRateStatMedalists(
  players: ProcessSkillResult[],
  stat: RateStatKey
): RankedProcessPlayer[] {
  return rankRateStat(
    players,
    stat
  ).filter(
    (player) =>
      player.rank <= 3
  )
}

// -----------------------------------------------------------------------------
// Formatting
// -----------------------------------------------------------------------------

export function formatProcessSkillValue(
  skill: ProcessSkillKey,
  value: number
): string {
  const definition =
    PROCESS_SKILLS.find(
      (item) =>
        item.key ===
        skill
    )

  if (
    !definition
  ) {
    return String(
      value
    )
  }

  return `${safeNumber(
    value
  ).toFixed(
    definition.decimals
  )}${definition.suffix}`
}

export function formatRateStat(
  value: number
): string {
  return safeNumber(
    value
  ).toFixed(2)
}

// -----------------------------------------------------------------------------
// Team / format helpers
// -----------------------------------------------------------------------------

export function groupPlayersByTeam(
  players: ProcessSkillResult[]
): Record<
  string,
  ProcessSkillResult[]
> {
  return players.reduce(
    (
      groups,
      player
    ) => {
      const team =
        player.team ||
        'Unknown'

      if (
        !groups[team]
      ) {
        groups[team] =
          []
      }

      groups[
        team
      ].push(
        player
      )

      return groups
    },
    {} as Record<
      string,
      ProcessSkillResult[]
    >
  )
}

export function groupPlayersByFormat(
  players: ProcessSkillResult[]
): Record<
  string,
  ProcessSkillResult[]
> {
  return players.reduce(
    (
      groups,
      player
    ) => {
      const format =
        player.format ||
        'Unknown'

      if (
        !groups[
          format
        ]
      ) {
        groups[
          format
        ] = []
      }

      groups[
        format
      ].push(
        player
      )

      return groups
    },
    {} as Record<
      string,
      ProcessSkillResult[]
    >
  )
}

// -----------------------------------------------------------------------------
// Medal Table
// -----------------------------------------------------------------------------

export type MedalCount = {
  playerId: number
  name: string
  team: string

  gold: number
  silver: number
  bronze: number
  total: number
}

export function calculateMedalTable(
  players: ProcessSkillResult[]
): MedalCount[] {
  const medals: Record<
    number,
    MedalCount
  > = {}

  /**
   * Only qualifying players need medal-table
   * entries.
   */
  players
    .filter(
      (player) =>
        player.eligible
    )
    .forEach(
      (player) => {
        medals[
          player.playerId
        ] = {
          playerId:
            player.playerId,

          name:
            player.name,

          team:
            player.team,

          gold: 0,
          silver: 0,
          bronze: 0,
          total: 0,
        }
      }
    )

  PROCESS_SKILLS.forEach(
    (skill) => {
      /**
       * getMedalists now automatically ignores
       * players without data for this category.
       */
      const winners =
        getMedalists(
          players,
          skill.key
        )

      winners.forEach(
        (player) => {
          const entry =
            medals[
              player.playerId
            ]

          if (!entry) {
            return
          }

          if (
            player.rank ===
            1
          ) {
            entry.gold++
          }

          if (
            player.rank ===
            2
          ) {
            entry.silver++
          }

          if (
            player.rank ===
            3
          ) {
            entry.bronze++
          }

          entry.total++
        }
      )
    }
  )

  return Object.values(
    medals
  )
    .filter(
      (player) =>
        player.total >
        0
    )
    .sort(
      (a, b) => {
        if (
          b.gold !==
          a.gold
        ) {
          return (
            b.gold -
            a.gold
          )
        }

        if (
          b.silver !==
          a.silver
        ) {
          return (
            b.silver -
            a.silver
          )
        }

        if (
          b.bronze !==
          a.bronze
        ) {
          return (
            b.bronze -
            a.bronze
          )
        }

        return (
          b.total -
          a.total
        )
      }
    )
}
