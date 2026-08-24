/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from 'next'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  PROCESS_SKILLS,
  type ProcessPlayer,
  type ProcessSkillKey,
  calculateProcessSkills,
  buildProcessSkillResults,
  getEligibilityThreshold,
  rankProcessSkill,
  formatProcessSkillValue,
} from '@/lib/processSkills'
import { getGameOutcome } from '@/lib/results'
import { PlayerTrendChart } from '@/components/PlayerTrendChart'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>
}): Promise<Metadata> {
  const { name } = await params
  const playerName = decodeURIComponent(name)

  return {
    title: `${playerName} — Flop Reset Player Profile`,
    description: `Career statistics, Process Skills, recent form, records, and opponent history for ${playerName}.`,
  }
}

type PlayerRow = {
  player_id: number
  name: string
  team_id: number
  aliases?: string[] | null
  teams?: {
    name?: string | null
    format?: string | null
  } | null
}

type SourceSamples = {
  bpm: number
  avgSpeed: number
  demos: number
  boost: number

  supersonic: number
  ground: number
  lowAir: number
  highAir: number

  defensiveThird: number
  neutralThird: number
  offensiveThird: number

  mostBack: number
  mostForward: number
  behindBall: number
  inFrontBall: number

  defensiveHalf: number
  offensiveHalf: number

  distanceBall: number
  distancePossession: number
  distanceNoPossession: number
  distanceTeammates: number

  zeroBoost: number
}

type ProcessSnapshot = {
  player: ProcessPlayer

  skillSamples: Record<
    ProcessSkillKey,
    number
  >

  basicProcessGames: number
  advancedTrackingGames: number
}

function numberValue(
  value: unknown
) {
  const parsed =
    Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : 0
}

function hasValue(
  value: unknown
) {
  return (
    value !== null &&
    value !== undefined &&
    value !== ''
  )
}

function average(
  total: number,
  count: number
) {
  return count > 0
    ? total / count
    : 0
}

function normalizeName(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
}

function pct(
  value: number
) {
  return `${value.toFixed(1)}%`
}

function buildProcessSnapshot(
  rows: any[],
  name: string,
  team: string,
  format: string
): ProcessSnapshot {
  const sourceSamples:
    SourceSamples = {
    bpm: 0,
    avgSpeed: 0,
    demos: 0,
    boost: 0,

    supersonic: 0,
    ground: 0,
    lowAir: 0,
    highAir: 0,

    defensiveThird: 0,
    neutralThird: 0,
    offensiveThird: 0,

    mostBack: 0,
    mostForward: 0,
    behindBall: 0,
    inFrontBall: 0,

    defensiveHalf: 0,
    offensiveHalf: 0,

    distanceBall: 0,
    distancePossession: 0,
    distanceNoPossession: 0,
    distanceTeammates: 0,

    zeroBoost: 0,
  }

  const totals = {
    goals: 0,
    assists: 0,
    saves: 0,
    shots: 0,

    bpm: 0,
    avgSpeed: 0,

    demosInflicted: 0,
    demosTaken: 0,

    boostCollected: 0,
    boostStolen: 0,

    supersonicPct: 0,
    groundPct: 0,
    lowAirPct: 0,
    highAirPct: 0,

    defensiveThirdPct: 0,
    neutralThirdPct: 0,
    offensiveThirdPct: 0,

    mostBackPct: 0,
    mostForwardPct: 0,
    behindBallPct: 0,
    inFrontOfBallPct: 0,

    defensiveHalfPct: 0,
    offensiveHalfPct: 0,

    avgDistanceToBall: 0,
    avgDistanceToBallHasPossession: 0,
    avgDistanceToBallNoPossession: 0,
    avgDistanceToTeammates: 0,

    zeroBoostPct: 0,
  }

  let basicProcessGames = 0
  let advancedTrackingGames = 0

  rows.forEach((stat) => {
    if (
      hasValue(stat.bpm) ||
      hasValue(stat.avg_speed) ||
      hasValue(stat.demos_inflicted) ||
      hasValue(stat.demos_taken) ||
      hasValue(stat.boost_collected) ||
      hasValue(stat.boost_stolen)
    ) {
      basicProcessGames++
    }

    totals.goals +=
      numberValue(
        stat.goals
      )

    totals.assists +=
      numberValue(
        stat.assists
      )

    totals.saves +=
      numberValue(
        stat.saves
      )

    totals.shots +=
      numberValue(
        stat.shots
      )

    if (
      hasValue(
        stat.bpm
      )
    ) {
      totals.bpm +=
        numberValue(
          stat.bpm
        )

      sourceSamples.bpm++
    }

    if (
      hasValue(
        stat.avg_speed
      )
    ) {
      totals.avgSpeed +=
        numberValue(
          stat.avg_speed
        )

      sourceSamples.avgSpeed++
    }

    if (
      hasValue(
        stat.demos_inflicted
      ) ||
      hasValue(
        stat.demos_taken
      )
    ) {
      totals.demosInflicted +=
        numberValue(
          stat.demos_inflicted
        )

      totals.demosTaken +=
        numberValue(
          stat.demos_taken
        )

      sourceSamples.demos++
    }

    if (
      hasValue(
        stat.boost_collected
      ) ||
      hasValue(
        stat.boost_stolen
      )
    ) {
      totals.boostCollected +=
        numberValue(
          stat.boost_collected
        )

      totals.boostStolen +=
        numberValue(
          stat.boost_stolen
        )

      sourceSamples.boost++
    }

    if (
      hasValue(
        stat.percentage_supersonic_speed
      )
    ) {
      totals.supersonicPct +=
        numberValue(
          stat.percentage_supersonic_speed
        )

      sourceSamples.supersonic++
    }

    if (
      hasValue(
        stat.percentage_on_ground
      )
    ) {
      totals.groundPct +=
        numberValue(
          stat.percentage_on_ground
        )

      sourceSamples.ground++
    }

    if (
      hasValue(
        stat.percentage_low_air
      )
    ) {
      totals.lowAirPct +=
        numberValue(
          stat.percentage_low_air
        )

      sourceSamples.lowAir++
    }

    if (
      hasValue(
        stat.percentage_high_air
      )
    ) {
      totals.highAirPct +=
        numberValue(
          stat.percentage_high_air
        )

      sourceSamples.highAir++
    }

    if (
      hasValue(
        stat.percentage_defensive_third
      )
    ) {
      totals.defensiveThirdPct +=
        numberValue(
          stat.percentage_defensive_third
        )

      sourceSamples.defensiveThird++
    }

    if (
      hasValue(
        stat.percentage_neutral_third
      )
    ) {
      totals.neutralThirdPct +=
        numberValue(
          stat.percentage_neutral_third
        )

      sourceSamples.neutralThird++
    }

    if (
      hasValue(
        stat.percentage_offensive_third
      )
    ) {
      totals.offensiveThirdPct +=
        numberValue(
          stat.percentage_offensive_third
        )

      sourceSamples.offensiveThird++
    }

    if (
      hasValue(
        stat.percentage_most_back
      )
    ) {
      totals.mostBackPct +=
        numberValue(
          stat.percentage_most_back
        )

      sourceSamples.mostBack++
    }

    if (
      hasValue(
        stat.percentage_most_forward
      )
    ) {
      totals.mostForwardPct +=
        numberValue(
          stat.percentage_most_forward
        )

      sourceSamples.mostForward++
    }

    if (
      hasValue(
        stat.percentage_behind_ball
      )
    ) {
      totals.behindBallPct +=
        numberValue(
          stat.percentage_behind_ball
        )

      sourceSamples.behindBall++
    }

    if (
      hasValue(
        stat.percentage_in_front_of_ball
      )
    ) {
      totals.inFrontOfBallPct +=
        numberValue(
          stat.percentage_in_front_of_ball
        )

      sourceSamples.inFrontBall++
    }

    if (
      hasValue(
        stat.percentage_defensive_half
      )
    ) {
      totals.defensiveHalfPct +=
        numberValue(
          stat.percentage_defensive_half
        )

      sourceSamples.defensiveHalf++
    }

    if (
      hasValue(
        stat.percentage_offensive_half
      )
    ) {
      totals.offensiveHalfPct +=
        numberValue(
          stat.percentage_offensive_half
        )

      sourceSamples.offensiveHalf++
    }

    if (
      hasValue(
        stat.avg_distance_to_ball
      )
    ) {
      totals.avgDistanceToBall +=
        numberValue(
          stat.avg_distance_to_ball
        )

      sourceSamples.distanceBall++
    }

    if (
      hasValue(
        stat.avg_distance_to_ball_has_possession
      )
    ) {
      totals.avgDistanceToBallHasPossession +=
        numberValue(
          stat.avg_distance_to_ball_has_possession
        )

      sourceSamples.distancePossession++
    }

    if (
      hasValue(
        stat.avg_distance_to_ball_no_possession
      )
    ) {
      totals.avgDistanceToBallNoPossession +=
        numberValue(
          stat.avg_distance_to_ball_no_possession
        )

      sourceSamples.distanceNoPossession++
    }

    if (
      hasValue(
        stat.avg_distance_to_teammates
      )
    ) {
      totals.avgDistanceToTeammates +=
        numberValue(
          stat.avg_distance_to_teammates
        )

      sourceSamples.distanceTeammates++
    }

    if (
      hasValue(
        stat.zero_boost_pct
      )
    ) {
      totals.zeroBoostPct +=
        numberValue(
          stat.zero_boost_pct
        )

      sourceSamples.zeroBoost++
    }

    if (
      hasValue(
        stat.percentage_supersonic_speed
      ) ||
      hasValue(
        stat.percentage_defensive_third
      ) ||
      hasValue(
        stat.percentage_low_air
      ) ||
      hasValue(
        stat.zero_boost_pct
      )
    ) {
      advancedTrackingGames++
    }
  })

  const positioningSample =
    Math.min(
      sourceSamples.defensiveThird,
      sourceSamples.behindBall,
      sourceSamples.mostBack,
      sourceSamples.defensiveHalf
    )

  const airSample =
    Math.min(
      sourceSamples.lowAir,
      sourceSamples.highAir
    )

  const skillSamples:
    Record<
      ProcessSkillKey,
      number
    > = {
    demoEfficiency:
      sourceSamples.demos,

    shotQuality:
      rows.length,

    boostStealRate:
      sourceSamples.boost,

    supersonicPct:
      sourceSamples.supersonic,

    bpm:
      sourceSamples.bpm,

    positioningDepth:
      positioningSample,

    avgSpeed:
      sourceSamples.avgSpeed,

    airTimePct:
      airSample,

    zeroBoostPct:
      sourceSamples.zeroBoost,
  }

  const player:
    ProcessPlayer = {
    playerId: 0,

    name,
    team,
    format,

    games:
      rows.length,

    goals:
      totals.goals,

    assists:
      totals.assists,

    saves:
      totals.saves,

    shots:
      totals.shots,

    bpm:
      average(
        totals.bpm,
        sourceSamples.bpm
      ),

    avgSpeed:
      average(
        totals.avgSpeed,
        sourceSamples.avgSpeed
      ),

    demosInflicted:
      totals.demosInflicted,

    demosTaken:
      totals.demosTaken,

    boostCollected:
      totals.boostCollected,

    boostStolen:
      totals.boostStolen,

    supersonicPct:
      average(
        totals.supersonicPct,
        sourceSamples.supersonic
      ),

    groundPct:
      average(
        totals.groundPct,
        sourceSamples.ground
      ),

    lowAirPct:
      average(
        totals.lowAirPct,
        sourceSamples.lowAir
      ),

    highAirPct:
      average(
        totals.highAirPct,
        sourceSamples.highAir
      ),

    defensiveThirdPct:
      average(
        totals.defensiveThirdPct,
        sourceSamples.defensiveThird
      ),

    neutralThirdPct:
      average(
        totals.neutralThirdPct,
        sourceSamples.neutralThird
      ),

    offensiveThirdPct:
      average(
        totals.offensiveThirdPct,
        sourceSamples.offensiveThird
      ),

    mostBackPct:
      average(
        totals.mostBackPct,
        sourceSamples.mostBack
      ),

    mostForwardPct:
      average(
        totals.mostForwardPct,
        sourceSamples.mostForward
      ),

    behindBallPct:
      average(
        totals.behindBallPct,
        sourceSamples.behindBall
      ),

    inFrontOfBallPct:
      average(
        totals.inFrontOfBallPct,
        sourceSamples.inFrontBall
      ),

    defensiveHalfPct:
      average(
        totals.defensiveHalfPct,
        sourceSamples.defensiveHalf
      ),

    offensiveHalfPct:
      average(
        totals.offensiveHalfPct,
        sourceSamples.offensiveHalf
      ),

    avgDistanceToBall:
      average(
        totals.avgDistanceToBall,
        sourceSamples.distanceBall
      ),

    avgDistanceToBallHasPossession:
      average(
        totals.avgDistanceToBallHasPossession,
        sourceSamples.distancePossession
      ),

    avgDistanceToBallNoPossession:
      average(
        totals.avgDistanceToBallNoPossession,
        sourceSamples.distanceNoPossession
      ),

    avgDistanceToTeammates:
      average(
        totals.avgDistanceToTeammates,
        sourceSamples.distanceTeammates
      ),

    zeroBoostPct:
      average(
        totals.zeroBoostPct,
        sourceSamples.zeroBoost
      ),

    dataAvailability: {
      demoEfficiency:
        sourceSamples.demos >
        0,

      shotQuality:
        rows.length > 0,

      boostStealRate:
        sourceSamples.boost >
        0,

      supersonicPct:
        sourceSamples.supersonic >
        0,

      bpm:
        sourceSamples.bpm >
        0,

      positioningDepth:
        positioningSample >
        0,

      avgSpeed:
        sourceSamples.avgSpeed >
        0,

      airTimePct:
        airSample > 0,

      zeroBoostPct:
        sourceSamples.zeroBoost >
        0,
    },
  }

  return {
    player,
    skillSamples,
    basicProcessGames,
    advancedTrackingGames,
  }
}

export default async function PlayerProfile({
  params,
  searchParams,
}: {
  params: Promise<{
    name: string
  }>

  searchParams?: Promise<{
    format?: string
  }>
}) {
  const {
    name,
  } = await params

  const query =
    searchParams
      ? await searchParams
      : {}

  const playerName =
    decodeURIComponent(
      name
    )

  // ---------------------------------------------------------------------------
  // PLAYER
  // ---------------------------------------------------------------------------

  const {
    data: rawPlayerRows,
    error: playerError,
  } = await supabase
    .from('players')
    .select(`
      player_id,
      name,
      team_id,
      aliases,
      teams (
        name,
        format
      )
    `)
    .eq(
      'name',
      playerName
    )

  const playerRows =
    (rawPlayerRows ??
      []) as unknown as PlayerRow[]

  if (
    playerError ||
    playerRows.length === 0
  ) {
    return (
      <main className="px-4 md:px-8 py-16 max-w-6xl mx-auto">
        <Link
          href="/stats"
          className="text-purple-400 hover:underline"
        >
          ← Back to Stats & Medals
        </Link>

        <div className="mt-10 rounded-2xl border border-neutral-800 bg-[#111111] p-8">
          <h1 className="text-3xl font-black">
            Player not found
          </h1>
        </div>
      </main>
    )
  }

  const playerIds =
    playerRows.map(
      (player) =>
        player.player_id
    )

  // ---------------------------------------------------------------------------
  // FORMATS
  // ---------------------------------------------------------------------------

  const requestedFormat =
    query.format ??
    'All'

  const aliases =
    Array.from(
      new Set(
        playerRows
          .flatMap(
            (player) =>
              player.aliases ??
              []
          )
          .filter(Boolean)
      )
    )

  // ---------------------------------------------------------------------------
  // PLAYER STATS
  // ---------------------------------------------------------------------------

  const {
    data: rawStats,
    error: statsError,
  } = await supabase
    .from(
      'match_player_stats'
    )
    .select(`
      stat_id,
      player_id,
      match_id,

      goals,
      assists,
      saves,
      shots,
      score,
      mvp,

      bpm,
      avg_speed,

      demos_inflicted,
      demos_taken,

      boost_collected,
      boost_stolen,

      percentage_supersonic_speed,
      percentage_on_ground,
      percentage_low_air,
      percentage_high_air,

      percentage_defensive_third,
      percentage_neutral_third,
      percentage_offensive_third,

      percentage_most_back,
      percentage_most_forward,
      percentage_behind_ball,
      percentage_in_front_of_ball,

      percentage_defensive_half,
      percentage_offensive_half,

      avg_distance_to_ball,
      avg_distance_to_ball_has_possession,
      avg_distance_to_ball_no_possession,
      avg_distance_to_teammates,

      zero_boost_pct,

      matches (
        *,
        teams (
          name,
          format
        )
      )
    `)
    .in(
      'player_id',
      playerIds
    )

  if (statsError) {
    console.error(
      statsError
    )
  }

  const allPlayerStats: any[] =
    rawStats ?? []

  const playedFormats =
    Array.from(
      new Set(
        allPlayerStats
          .map((stat: any) => stat.matches?.teams?.format ?? '')
          .filter(Boolean)
      )
    )

  const selectedFormat =
    requestedFormat !== 'All' &&
    playedFormats.includes(
      requestedFormat
    )
      ? requestedFormat
      : 'All'

  const selectedStats =
    allPlayerStats.filter(
      (stat: any) => {
        if (
          selectedFormat ===
          'All'
        ) {
          return true
        }

        return (
          stat.matches?.teams
            ?.format ===
          selectedFormat
        )
      }
    )

  // Box-score and Process metrics must never turn a forfeit into a fabricated
  // performance. Result records below still use selectedStats so an explicitly
  // attributed forfeit can count as a W/L without contributing goals or shots.
  const stats = selectedStats.filter((stat: any) => !stat.matches?.is_forfeit)

  const teamLabels =
    Array.from(
      new Set(
        selectedStats.map(
          (stat: any) =>
            `${
              stat.matches?.teams
                ?.name ??
              'Unknown'
            } (${
              stat.matches?.teams
                ?.format ??
              'Unknown'
            })`
        )
      )
    )

  const registeredTeamLabels =
    Array.from(
      new Set(
        playerRows.map(
          (player) =>
            `${
              player.teams?.name ??
              'Unknown'
            } (${
              player.teams?.format ??
              'Unknown'
            })`
        )
      )
    )

  // ---------------------------------------------------------------------------
  // TOTALS
  // ---------------------------------------------------------------------------

  const totals =
    stats.reduce(
      (
        total: any,
        stat: any
      ) => ({
        games:
          total.games +
          1,

        goals:
          total.goals +
          numberValue(
            stat.goals
          ),

        assists:
          total.assists +
          numberValue(
            stat.assists
          ),

        saves:
          total.saves +
          numberValue(
            stat.saves
          ),

        shots:
          total.shots +
          numberValue(
            stat.shots
          ),

        score:
          total.score +
          numberValue(
            stat.score
          ),

        mvps:
          total.mvps +
          (stat.mvp
            ? 1
            : 0),
      }),
      {
        games: 0,
        goals: 0,
        assists: 0,
        saves: 0,
        shots: 0,
        score: 0,
        mvps: 0,
      }
    )

  const goalsPerGame =
    average(
      totals.goals,
      totals.games
    )

  const assistsPerGame =
    average(
      totals.assists,
      totals.games
    )

  const savesPerGame =
    average(
      totals.saves,
      totals.games
    )

  const shotsPerGame =
    average(
      totals.shots,
      totals.games
    )

  const scorePerGame =
    average(
      totals.score,
      totals.games
    )

  const shootingPct =
    totals.shots > 0
      ? (
          totals.goals /
          totals.shots
        ) * 100
      : 0

  // ---------------------------------------------------------------------------
  // GAME RECORD
  // ---------------------------------------------------------------------------

  const wins = selectedStats.filter((stat: any) => getGameOutcome(stat.matches).result === 'W')

  const losses = selectedStats.filter((stat: any) => getGameOutcome(stat.matches).result === 'L')

  const ties = selectedStats.filter((stat: any) => getGameOutcome(stat.matches).result === 'T')

  const winRate =
    selectedStats.length > 0
      ? (
          wins.length /
          selectedStats.length
        ) * 100
      : 0

  // ---------------------------------------------------------------------------
  // PLAYER PROCESS SKILLS
  // ---------------------------------------------------------------------------

  const profileSnapshot =
    buildProcessSnapshot(
      stats,
      playerName,
      teamLabels.join(
        ' / '
      ),
      selectedFormat
    )

  const process =
    calculateProcessSkills(
      profileSnapshot.player,
      0
    )

  // ---------------------------------------------------------------------------
  // ORG-WIDE PROCESS DATA
  // ---------------------------------------------------------------------------

  const {
    data: rawOrgStats,
  } = await supabase
    .from(
      'match_player_stats'
    )
    .select(`
      stat_id,
      player_id,
      match_id,

      goals,
      assists,
      saves,
      shots,
      score,

      bpm,
      avg_speed,

      demos_inflicted,
      demos_taken,

      boost_collected,
      boost_stolen,

      percentage_supersonic_speed,
      percentage_on_ground,
      percentage_low_air,
      percentage_high_air,

      percentage_defensive_third,
      percentage_neutral_third,
      percentage_offensive_third,

      percentage_most_back,
      percentage_most_forward,
      percentage_behind_ball,
      percentage_in_front_of_ball,

      percentage_defensive_half,
      percentage_offensive_half,

      avg_distance_to_ball,
      avg_distance_to_ball_has_possession,
      avg_distance_to_ball_no_possession,
      avg_distance_to_teammates,

      zero_boost_pct,

      players (
        name
      ),
      matches (
        is_forfeit,
        teams (
          name,
          format
        )
      )
    `)

  const hasFormatSpecificRankings =
    selectedFormat !== 'All'

  const orgRows =
    (rawOrgStats ??
      []).filter(
      (stat: any) =>
        hasFormatSpecificRankings &&
        !stat.matches?.is_forfeit &&
        stat.matches
          ?.teams
          ?.format ===
          selectedFormat
    )

  const orgGroups =
    new Map<
      string,
      any[]
    >()

  orgRows.forEach(
    (stat: any) => {
      const name =
        stat.players
          ?.name

      if (!name) {
        return
      }

      const key =
        normalizeName(
          name
        )

      if (
        !orgGroups.has(
          key
        )
      ) {
        orgGroups.set(
          key,
          []
        )
      }

      orgGroups
        .get(key)!
        .push(stat)
    }
  )

  const orgSnapshots =
    Array.from(
      orgGroups.entries()
    ).map(
      ([, rows]) => {
        const first =
          rows[0]

        return buildProcessSnapshot(
          rows,
          first.players
            ?.name ??
            'Unknown',

          first.matches
            ?.teams
            ?.name ??
            'Unknown',

          selectedFormat
        )
      }
    )

  const orgProcessPlayers =
    orgSnapshots.map(
      (snapshot) =>
        snapshot.player
    )

  const orgProcessResults =
    buildProcessSkillResults(
      orgProcessPlayers
    )

  const orgEligibilityThreshold =
    getEligibilityThreshold(
      orgProcessPlayers
    )

  const processRankings =
    hasFormatSpecificRankings
      ? PROCESS_SKILLS.map(
      (skill) => {
        const ranked =
          rankProcessSkill(
            orgProcessResults,
            skill.key
          )

        const playerRank =
          ranked.find(
            (row) =>
              normalizeName(
                row.name
              ) ===
              normalizeName(
                playerName
              )
          )

        return {
          skill,
          rank:
            playerRank
              ?.rank ??
            null,

          medal:
            playerRank
              ?.medal ??
            '',

          eligiblePlayers:
            ranked.length,
        }
      }
        )
      : []

  const medals =
    processRankings.filter(
      (item) =>
        item.medal
    )

  // ---------------------------------------------------------------------------
  // CHRONOLOGICAL DATA
  // ---------------------------------------------------------------------------

  const chronological =
    [...stats].sort(
      (
        a: any,
        b: any
      ) => {
        const date =
          String(
            a.matches
              ?.match_date ??
              ''
          ).localeCompare(
            String(
              b.matches
                ?.match_date ??
                ''
            )
          )

        if (date) {
          return date
        }

        return (
          numberValue(
            a.match_id
          ) -
          numberValue(
            b.match_id
          )
        )
      }
    )

  const debut =
    chronological[0]
      ?.matches
      ?.match_date ??
    null

  // ---------------------------------------------------------------------------
  // RECENT FORM
  // ---------------------------------------------------------------------------

  const recentFive =
    chronological.slice(
      -5
    )

  const recentGoals =
    average(
      recentFive.reduce(
        (
          total: number,
          stat: any
        ) =>
          total +
          numberValue(
            stat.goals
          ),
        0
      ),
      recentFive.length
    )

  const recentAssists =
    average(
      recentFive.reduce(
        (
          total: number,
          stat: any
        ) =>
          total +
          numberValue(
            stat.assists
          ),
        0
      ),
      recentFive.length
    )

  const recentSaves =
    average(
      recentFive.reduce(
        (
          total: number,
          stat: any
        ) =>
          total +
          numberValue(
            stat.saves
          ),
        0
      ),
      recentFive.length
    )

  const trendPoints = chronological.slice(-12).map((stat: any) => ({
    id: numberValue(stat.match_id),
    date: String(stat.matches?.match_date ?? '').slice(0, 10),
    opponent: stat.matches?.opponent_name ?? 'Unknown',
    goals: numberValue(stat.goals),
    assists: numberValue(stat.assists),
    saves: numberValue(stat.saves),
  }))

  // ---------------------------------------------------------------------------
  // OPPONENT SPLITS
  // ---------------------------------------------------------------------------

  const opponentMap =
    new Map<
      string,
      {
        opponent: string
        games: number
        wins: number
        losses: number
        goals: number
        assists: number
        saves: number
      }
    >()

  selectedStats.forEach(
    (stat: any) => {
      const opponent =
        stat.matches
          ?.opponent_name ??
        'Unknown'

      if (
        !opponentMap.has(
          opponent
        )
      ) {
        opponentMap.set(
          opponent,
          {
            opponent,
            games: 0,
            wins: 0,
            losses: 0,
            goals: 0,
            assists: 0,
            saves: 0,
          }
        )
      }

      const row =
        opponentMap.get(
          opponent
        )!

      row.games++

      if (!stat.matches?.is_forfeit) {
        row.goals += numberValue(stat.goals)

        row.assists += numberValue(stat.assists)

        row.saves += numberValue(stat.saves)
      }

      const outcome = getGameOutcome(stat.matches)
      if (outcome.result === 'W') {
        row.wins++
      }

      if (outcome.result === 'L') {
        row.losses++
      }
    }
  )

  const opponentSplits =
    Array.from(
      opponentMap.values()
    ).sort(
      (a, b) =>
        b.games -
        a.games
    )

  // ---------------------------------------------------------------------------
  // SERIES HISTORY
  // ---------------------------------------------------------------------------

  const seriesMap =
    new Map<
      string,
      {
        key: string
        seriesId: string
        date: string
        opponent: string
        format: string
        games: any[]
        gameWins: number
        gameLosses: number
        goals: number
        assists: number
        saves: number
        shots: number
        score: number
      }
    >()

  const resultChronological = [...selectedStats].sort((a: any, b: any) => String(a.matches?.match_date ?? '').localeCompare(String(b.matches?.match_date ?? '')) || numberValue(a.match_id) - numberValue(b.match_id))

  resultChronological.forEach(
    (stat: any) => {
      const rawSeriesId =
        stat.matches
          ?.series_id

      const key =
        rawSeriesId !==
          null &&
        rawSeriesId !==
          undefined
          ? String(
              rawSeriesId
            )
          : `match-${stat.match_id}`

      if (
        !seriesMap.has(
          key
        )
      ) {
        seriesMap.set(
          key,
          {
            key,
            seriesId:
              key,

            date:
              stat.matches
                ?.match_date ??
              '',

            opponent:
              stat.matches
                ?.opponent_name ??
              'Unknown',

            format:
              stat.matches?.teams
                ?.format ??
              '',

            games: [],

            gameWins: 0,
            gameLosses: 0,

            goals: 0,
            assists: 0,
            saves: 0,
            shots: 0,
            score: 0,
          }
        )
      }

      const series =
        seriesMap.get(
          key
        )!

      series.games.push(
        stat
      )

      if (!stat.matches?.is_forfeit) {
        series.goals += numberValue(stat.goals)
        series.assists += numberValue(stat.assists)
        series.saves += numberValue(stat.saves)
        series.shots += numberValue(stat.shots)
        series.score += numberValue(stat.score)
      }

      const outcome = getGameOutcome(stat.matches)
      if (outcome.result === 'W') {
        series.gameWins++
      }

      if (outcome.result === 'L') {
        series.gameLosses++
      }
    }
  )

  const seriesHistory =
    Array.from(
      seriesMap.values()
    )
      .map(
        (series) => ({
          ...series,

          games:
            [...series.games].sort(
              (
                a,
                b
              ) =>
                numberValue(
                  a.match_id
                ) -
                numberValue(
                  b.match_id
                )
            ),
        })
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(
            a.date
          )
      )

  const seriesWins =
    seriesHistory.filter(
      (series) =>
        series.gameWins >
        series.gameLosses
    ).length

  const seriesLosses =
    seriesHistory.filter(
      (series) =>
        series.gameWins <
        series.gameLosses
    ).length

  const seriesTies =
    seriesHistory.length -
    seriesWins -
    seriesLosses

  const seriesWinRate =
    seriesHistory.length > 0
      ? (seriesWins /
          seriesHistory.length) *
        100
      : 0

  // ---------------------------------------------------------------------------
  // CAREER HIGHS
  // ---------------------------------------------------------------------------

  const careerHighs =
    [
      {
        key:
          'goals',
        label:
          'Goals',
      },
      {
        key:
          'assists',
        label:
          'Assists',
      },
      {
        key:
          'saves',
        label:
          'Saves',
      },
      {
        key:
          'shots',
        label:
          'Shots',
      },
      {
        key:
          'score',
        label:
          'Score',
      },
    ].map(
      (definition) => {
        const best =
          [...stats].sort(
            (
              a: any,
              b: any
            ) =>
              numberValue(
                b[
                  definition.key
                ]
              ) -
              numberValue(
                a[
                  definition.key
                ]
              )
          )[0]

        return {
          ...definition,

          value:
            best
              ? numberValue(
                  best[
                    definition.key
                  ]
                )
              : 0,

          opponent:
            best?.matches
              ?.opponent_name ??
            '',

          date:
            best?.matches
              ?.match_date ??
            '',

          ourScore:
            best
              ? numberValue(
                  best.matches
                    ?.flop_reset_score
                )
              : 0,

          theirScore:
            best
              ? numberValue(
                  best.matches
                    ?.opponent_score
                )
              : 0,
        }
      }
    )

  return (
    <main className="px-4 md:px-8 py-10 md:py-14 max-w-7xl mx-auto">

      {/* BACK */}

      <Link
        href="/stats"
        className="text-sm text-purple-400 hover:underline"
      >
        ← Back to Stats & Medals
      </Link>

      {/* HERO */}

      <section className="mt-6 mb-10 rounded-3xl border border-neutral-800 bg-gradient-to-br from-[#171717] to-[#0d0d0d] overflow-hidden">
        <div className="p-6 md:p-9">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-8">

            <div>
              <div className="mb-4 space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-neutral-600 mb-2">
                    Played Formats
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {teamLabels.map(
                      (label) => (
                        <span
                          key={label}
                          className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-950/40 border border-purple-800/50 text-purple-300"
                        >
                          {label}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wider text-neutral-600 mb-2">
                    Roster Registrations
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {registeredTeamLabels.map(
                  (label) => (
                    <span
                      key={
                        label
                      }
                      className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-950/40 border border-purple-800/50 text-purple-300"
                    >
                      {label}
                    </span>
                  )
                )}
                  </div>
                </div>
              </div>

              <h1 className="text-5xl md:text-7xl font-black tracking-tight">
                {playerName}
              </h1>

              {aliases.length >
                0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-neutral-600">
                    Aliases
                  </span>

                  {aliases.map(
                    (alias) => (
                      <span
                        key={
                          alias
                        }
                        className="text-sm text-neutral-400 bg-black/20 border border-neutral-800 rounded-full px-3 py-1"
                      >
                        {alias}
                      </span>
                    )
                  )}
                </div>
              )}

              {debut && (
                <div className="mt-4 text-sm text-neutral-600">
                  Flop Reset debut:{' '}
                  <span className="text-neutral-400">
                    {debut}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 min-w-full xl:min-w-[720px]">
              <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wide text-neutral-600">
                  Game Record
                </div>

                <div className="text-2xl font-black mt-1">
                  <span className="text-emerald-400">
                    {wins.length}
                  </span>
                  -
                  <span className="text-red-400">
                    {losses.length}
                  </span>

                  {ties.length >
                    0 && (
                    <span className="text-neutral-500">
                      -
                      {
                        ties.length
                      }
                    </span>
                  )}
                </div>

                <div className="text-xs text-neutral-500 mt-1">
                  {pct(winRate)} win rate
                </div>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wide text-neutral-600">
                  Series Record
                </div>

                <div className="text-2xl font-black mt-1">
                  <span className="text-emerald-400">
                    {seriesWins}
                  </span>
                  -
                  <span className="text-red-400">
                    {seriesLosses}
                  </span>

                  {seriesTies > 0 && (
                    <span className="text-neutral-500">
                      -{seriesTies}
                    </span>
                  )}
                </div>

                <div className="text-xs text-neutral-500 mt-1">
                  {pct(seriesWinRate)} win rate
                </div>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wide text-neutral-600">
                  Games
                </div>

                <div className="text-2xl font-black mt-1">
                  {
                    totals.games
                  }
                </div>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wide text-neutral-600">
                  Basic Process Data
                </div>

                <div className="text-2xl font-black mt-1">
                  {
                    profileSnapshot.basicProcessGames
                  }
                  <span className="text-neutral-600">
                    /
                    {
                      totals.games
                    }
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wide text-neutral-600">
                  Advanced Tracking
                </div>

                <div className="text-2xl font-black mt-1">
                  {
                    profileSnapshot.advancedTrackingGames
                  }
                  <span className="text-neutral-600">
                    /{totals.games}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* MEDALS */}

          {medals.length >
            0 && (
            <div className="mt-8 pt-6 border-t border-neutral-800">
              <div className="text-xs uppercase tracking-wider text-neutral-600 mb-3">
                Current Process Skill Medals
              </div>

              <div className="flex flex-wrap gap-2">
                {medals.map(
                  (
                    ranking
                  ) => (
                    <span
                      key={
                        ranking
                          .skill
                          .key
                      }
                      className="rounded-full border border-neutral-700 bg-black/30 px-3 py-2 text-sm"
                    >
                      {
                        ranking.medal
                      }{' '}
                      <span className="font-semibold">
                        {
                          ranking
                            .skill
                            .label
                        }
                      </span>
                    </span>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FORMAT */}

      <div className="flex gap-2 mb-10">
        <Link
          href={`/players/${encodeURIComponent(
            playerName
          )}`}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            selectedFormat ===
            'All'
              ? 'bg-purple-700 text-white'
              : 'bg-[#1b1b1b] border border-neutral-800 text-neutral-400'
          }`}
        >
          All
        </Link>

        {playedFormats.map(
          (format) => (
            <Link
              key={
                format
              }
              href={`/players/${encodeURIComponent(
                playerName
              )}?format=${encodeURIComponent(
                format
              )}`}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                selectedFormat ===
                format
                  ? 'bg-purple-700 text-white'
                  : 'bg-[#1b1b1b] border border-neutral-800 text-neutral-400'
              }`}
            >
              {format}
            </Link>
          )
        )}
      </div>

      {/* CAREER OVERVIEW */}

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">
          Career Overview
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {[
            {
              label:
                'Goals',
              value:
                totals.goals,
            },
            {
              label:
                'Assists',
              value:
                totals.assists,
            },
            {
              label:
                'Saves',
              value:
                totals.saves,
            },
            {
              label:
                'Shots',
              value:
                totals.shots,
            },
            {
              label:
                'Score',
              value:
                totals.score,
            },
            {
              label:
                'MVPs',
              value:
                totals.mvps,
            },
            {
              label:
                'SH%',
              value:
                pct(
                  shootingPct
                ),
            },
          ].map(
            (stat) => (
              <div
                key={
                  stat.label
                }
                className="rounded-xl bg-[#151515] border border-neutral-800 p-4"
              >
                <div className="text-xs uppercase tracking-wider text-neutral-600">
                  {
                    stat.label
                  }
                </div>

                <div
                  className="text-3xl font-black mt-1"
                  style={{
                    color:
                      '#AF69EE',
                  }}
                >
                  {
                    stat.value
                  }
                </div>
              </div>
            )
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
          {[
            {
              label:
                'G / GP',
              value:
                goalsPerGame.toFixed(
                  2
                ),
            },
            {
              label:
                'A / GP',
              value:
                assistsPerGame.toFixed(
                  2
                ),
            },
            {
              label:
                'SV / GP',
              value:
                savesPerGame.toFixed(
                  2
                ),
            },
            {
              label:
                'SH / GP',
              value:
                shotsPerGame.toFixed(
                  2
                ),
            },
            {
              label:
                'Score / GP',
              value:
                Math.round(
                  scorePerGame
                ),
            },
          ].map(
            (stat) => (
              <div
                key={
                  stat.label
                }
                className="rounded-xl border border-neutral-800 bg-[#101010] p-4"
              >
                <div className="text-xs text-neutral-600 uppercase tracking-wide">
                  {
                    stat.label
                  }
                </div>

                <div className="text-xl font-bold mt-1">
                  {
                    stat.value
                  }
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {/* PROCESS SKILLS */}

      <section className="mb-12 rounded-2xl border border-neutral-800 bg-[#111111] overflow-hidden">
        <div className="p-5 md:p-6 border-b border-neutral-800 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">
              Process Skills
            </h2>

            <p className="text-sm text-neutral-500 mt-1">
              Player value, tracked sample, and org-wide ranking.
            </p>
          </div>

          {hasFormatSpecificRankings ? (
            <div className="text-sm text-neutral-500">
              {selectedFormat} ranking eligibility:{' '}
              <span className="text-white font-semibold">
                {orgEligibilityThreshold} GP
              </span>
            </div>
          ) : (
            <div className="text-sm text-neutral-500">
              Select a played format for org rankings and medals.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {PROCESS_SKILLS.map(
            (skill) => {
              const available =
                process
                  .availableSkills[
                  skill.key
                ]

              const ranking =
                processRankings.find(
                  (item) =>
                    item.skill
                      .key ===
                    skill.key
                )

              const sample =
                profileSnapshot
                  .skillSamples[
                  skill.key
                ]

              return (
                <div
                  key={
                    skill.key
                  }
                  className="p-5 border-b border-r border-neutral-800"
                >
                  <div className="flex justify-between gap-4">
                    <div className="font-semibold">
                      {
                        skill.label
                      }
                    </div>

                    {ranking
                      ?.medal && (
                      <div className="text-xl">
                        {
                          ranking.medal
                        }
                      </div>
                    )}
                  </div>

                  {available ? (
                    <>
                      <div className="flex items-end justify-between gap-4 mt-3">
                        <div
                          className="text-3xl font-black"
                          style={{
                            color:
                              '#AF69EE',
                          }}
                        >
                          {formatProcessSkillValue(
                            skill.key,
                            process[
                              skill.key
                            ]
                          )}
                        </div>

                        <div className="text-right">
                          {ranking?.rank ? (
                            <>
                              <div className="text-sm font-bold text-white">
                                #
                                {
                                  ranking.rank
                                }{' '}
                                /{' '}
                                {
                                  ranking.eligiblePlayers
                                }
                              </div>

                              <div className="text-xs text-neutral-600">
                                Org Rank
                              </div>
                            </>
                          ) : hasFormatSpecificRankings ? (
                            <div className="text-xs text-neutral-600">
                              Not ranked
                            </div>
                          ) : (
                            <div className="text-xs text-neutral-600">
                              Format-specific only
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-neutral-600 mt-2">
                        {
                          sample
                        }{' '}
                        tracked game
                        {sample ===
                        1
                          ? ''
                          : 's'}
                      </div>
                    </>
                  ) : (
                    <div className="mt-3">
                      <div className="text-2xl font-bold text-neutral-700">
                        —
                      </div>

                      <div className="text-xs text-neutral-600 mt-2">
                        Detailed tracking not yet available
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-neutral-600 mt-4">
                    {
                      skill.description
                    }
                  </p>

                  {skill.key ===
                    'positioningDepth' && (
                    <p className="text-xs text-purple-400/60 mt-2">
                      Higher means deeper positioning, not necessarily better.
                    </p>
                  )}

                  {skill.direction ===
                    'lower' && (
                    <p className="text-xs text-emerald-500/60 mt-2">
                      Lower is better.
                    </p>
                  )}
                </div>
              )
            }
          )}
        </div>
      </section>

      {/* RECENT FORM */}

      <section className="mb-12">
        <div className="rounded-2xl border border-neutral-800 bg-[#111111] p-5 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold">
                Recent Form
              </h2>

              <p className="text-sm text-neutral-500 mt-1">
                Last{' '}
                {
                  recentFive.length
                }{' '}
                recorded games
              </p>

              <div className="flex gap-2 mt-4">
                {recentFive.map(
                  (
                    stat: any,
                    index
                  ) => {
                    const our =
                      numberValue(
                        stat.matches
                          ?.flop_reset_score
                      )

                    const their =
                      numberValue(
                        stat.matches
                          ?.opponent_score
                      )

                    const won =
                      our >
                      their

                    return (
                      <span
                        key={
                          index
                        }
                        className={`w-10 h-10 rounded-lg flex items-center justify-center font-black border ${
                          won
                            ? 'border-emerald-900 bg-emerald-950 text-emerald-400'
                            : 'border-red-900 bg-red-950 text-red-400'
                        }`}
                      >
                        {won
                          ? 'W'
                          : 'L'}
                      </span>
                    )
                  }
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-neutral-800 p-4 min-w-[100px]">
                <div className="text-xs text-neutral-600">
                  G/GP
                </div>

                <div className="text-xl font-bold">
                  {recentGoals.toFixed(
                    2
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-neutral-800 p-4 min-w-[100px]">
                <div className="text-xs text-neutral-600">
                  A/GP
                </div>

                <div className="text-xl font-bold">
                  {recentAssists.toFixed(
                    2
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-neutral-800 p-4 min-w-[100px]">
                <div className="text-xs text-neutral-600">
                  SV/GP
                </div>

                <div className="text-xl font-bold">
                  {recentSaves.toFixed(
                    2
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PlayerTrendChart points={trendPoints} />

      {/* CAREER HIGHS */}

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">
          Career Highs
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {careerHighs.map(
            (high) => (
              <div
                key={
                  high.key
                }
                className="rounded-xl border border-neutral-800 bg-[#111111] p-4"
              >
                <div className="text-xs uppercase tracking-wider text-neutral-600">
                  {
                    high.label
                  }
                </div>

                <div className="text-3xl font-black mt-1">
                  {
                    high.value
                  }
                </div>

                {high.opponent && (
                  <>
                    <div className="text-xs text-neutral-400 mt-3">
                      vs{' '}
                      {
                        high.opponent
                      }
                    </div>

                    <div className="text-xs text-neutral-600 mt-1">
                      {
                        high.ourScore
                      }
                      -
                      {
                        high.theirScore
                      }{' '}
                      ·{' '}
                      {
                        high.date
                      }
                    </div>
                  </>
                )}
              </div>
            )
          )}
        </div>
      </section>

      {/* OPPONENT SPLITS */}

      <section className="mb-12">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">
            Opponent History
          </h2>

          <p className="text-sm text-neutral-500 mt-1">
            Career performance against each opponent.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full text-sm min-w-[750px]">
            <thead>
              <tr className="bg-[#1b1b1b] text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3 text-left">
                  Opponent
                </th>

                <th className="px-4 py-3 text-left">
                  GP
                </th>

                <th className="px-4 py-3 text-left">
                  Game Record
                </th>

                <th className="px-4 py-3 text-left">
                  Win %
                </th>

                <th className="px-4 py-3 text-left">
                  G/GP
                </th>

                <th className="px-4 py-3 text-left">
                  A/GP
                </th>

                <th className="px-4 py-3 text-left">
                  SV/GP
                </th>
              </tr>
            </thead>

            <tbody>
              {opponentSplits.map(
                (row) => (
                  <tr
                    key={
                      row.opponent
                    }
                    className="border-t border-neutral-800"
                  >
                    <td className="px-4 py-3 font-semibold">
                      {
                        row.opponent
                      }
                    </td>

                    <td className="px-4 py-3">
                      {
                        row.games
                      }
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-emerald-400">
                        {
                          row.wins
                        }
                      </span>
                      -
                      <span className="text-red-400">
                        {
                          row.losses
                        }
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {pct(
                        average(
                          row.wins *
                            100,
                          row.games
                        )
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {average(
                        row.goals,
                        row.games
                      ).toFixed(
                        2
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {average(
                        row.assists,
                        row.games
                      ).toFixed(
                        2
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {average(
                        row.saves,
                        row.games
                      ).toFixed(
                        2
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SERIES HISTORY */}

      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-bold">
            Series History
          </h2>

          <p className="text-sm text-neutral-500 mt-1">
            Series-level history with expandable game details.
          </p>
        </div>

        <div className="space-y-3">
          {seriesHistory.map(
            (series) => {
              const won =
                series.gameWins >
                series.gameLosses

              const lost =
                series.gameWins <
                series.gameLosses

              return (
                <details
                  key={
                    series.key
                  }
                  className="group rounded-xl border border-neutral-800 bg-[#111111] overflow-hidden"
                >
                  <summary className="cursor-pointer list-none p-4 md:p-5 hover:bg-[#161616]">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-11 h-11 rounded-lg flex items-center justify-center font-black border ${
                            won
                              ? 'bg-emerald-950 border-emerald-900 text-emerald-400'
                              : lost
                              ? 'bg-red-950 border-red-900 text-red-400'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                          }`}
                        >
                          {won
                            ? 'W'
                            : lost
                            ? 'L'
                            : '—'}
                        </div>

                        <div>
                          <div className="font-bold text-lg">
                            vs{' '}
                            {
                              series.opponent
                            }
                          </div>

                          <div className="text-sm text-neutral-500">
                            {
                              series.date
                            }{' '}
                            {series.format
                              ? `· ${series.format}`
                              : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        <div>
                          <span className="text-neutral-600">
                            Series
                          </span>{' '}
                          <span className="font-black">
                            {
                              series.gameWins
                            }
                            -
                            {
                              series.gameLosses
                            }
                          </span>
                        </div>

                        <div>
                          <span className="font-semibold">
                            {
                              series.goals
                            }
                          </span>
                          G
                        </div>

                        <div>
                          <span className="font-semibold">
                            {
                              series.assists
                            }
                          </span>
                          A
                        </div>

                        <div>
                          <span className="font-semibold">
                            {
                              series.saves
                            }
                          </span>
                          SV
                        </div>

                        <div className="text-neutral-600">
                          {
                            series.games
                              .length
                          }{' '}
                          games
                        </div>

                        <div className="text-neutral-600 group-open:rotate-180 transition-transform">
                          ▼
                        </div>
                      </div>
                    </div>
                  </summary>

                  <div className="border-t border-neutral-800">
                    {series.games.map(
                      (
                        stat: any,
                        index
                      ) => {
                        const our =
                          numberValue(
                            stat.matches
                              ?.flop_reset_score
                          )

                        const their =
                          numberValue(
                            stat.matches
                              ?.opponent_score
                          )

                        const gameWon =
                          our >
                          their

                        return (
                          <div
                            key={
                              stat.stat_id ??
                              index
                            }
                            className="px-4 md:px-5 py-4 border-b border-neutral-900 last:border-b-0 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`text-xs font-black w-7 h-7 rounded flex items-center justify-center ${
                                  gameWon
                                    ? 'bg-emerald-950 text-emerald-400'
                                    : 'bg-red-950 text-red-400'
                                }`}
                              >
                                {gameWon
                                  ? 'W'
                                  : 'L'}
                              </span>

                              <span className="font-semibold">
                                {our}
                                -
                                {their}
                              </span>

                              <span className="text-xs text-neutral-600">
                                Game{' '}
                                {
                                  index +
                                  1
                                }
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                              <span>
                                <strong>
                                  {
                                    numberValue(
                                      stat.goals
                                    )
                                  }
                                </strong>
                                G
                              </span>

                              <span>
                                <strong>
                                  {
                                    numberValue(
                                      stat.assists
                                    )
                                  }
                                </strong>
                                A
                              </span>

                              <span>
                                <strong>
                                  {
                                    numberValue(
                                      stat.saves
                                    )
                                  }
                                </strong>
                                SV
                              </span>

                              <span>
                                <strong>
                                  {
                                    numberValue(
                                      stat.shots
                                    )
                                  }
                                </strong>
                                SH
                              </span>

                              <span className="text-neutral-500">
                                {
                                  numberValue(
                                    stat.score
                                  )
                                }{' '}
                                score
                              </span>

                              {stat.mvp && (
                                <span className="text-purple-400 font-semibold">
                                  ★ MVP
                                </span>
                              )}

                              {hasValue(
                                stat.percentage_supersonic_speed
                              ) && (
                                <span className="text-emerald-500 text-xs border border-emerald-900 rounded-full px-2 py-0.5">
                                  Detailed
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      }
                    )}
                  </div>
                </details>
              )
            }
          )}
        </div>
      </section>
    </main>
  )
}
