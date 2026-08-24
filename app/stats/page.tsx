/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  PROCESS_SKILLS,
  RATE_STATS,
  type ProcessPlayer,
  type ProcessSkillKey,
  buildProcessSkillResults,
  getEligibilityThreshold,
  getMedalists,
  getIneligiblePlayers,
  formatProcessSkillValue,
  formatRateStat,
  calculateMedalTable,
} from '@/lib/processSkills'

type Row = ProcessPlayer & {
  score: number
  mvps: number
  shPct: number
  demoRatio: number
  goalsPerGame: number
  assistsPerGame: number
  savesPerGame: number
}

type AggregateRow = Row & {
  samples: {
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
}

type SortKey =
  | 'name'
  | 'team'
  | 'format'
  | 'games'
  | 'goals'
  | 'assists'
  | 'saves'
  | 'shots'
  | 'shPct'
  | 'score'
  | 'mvps'
  | 'bpm'
  | 'avgSpeed'
  | 'demoRatio'
  | 'goalsPerGame'
  | 'assistsPerGame'
  | 'savesPerGame'

function avg(total: number, count: number) {
  return count > 0 ? total / count : 0
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== ''
}

export default function Stats() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('All')
  const [formatFilter, setFormatFilter] = useState('All')

  const [sortKey, setSortKey] = useState<SortKey>('goals')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [view, setView] = useState<'box' | 'process'>('box')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError('')

      const { data: full, error } = await supabase
        .from('match_player_stats')
        .select(`
          player_id,
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

      if (error) {
        console.error(error)
        setLoadError(error.message)
        setLoading(false)
        return
      }

      const byPlayer: Record<string, AggregateRow> = {}

      full?.forEach((stat: any) => {
        const pid = Number(stat.player_id)
        const historicalTeam = stat.matches?.teams

        if (!pid || stat.matches?.is_forfeit) return

        const aggregateKey = `${pid}|${historicalTeam?.name ?? 'Unknown'}|${historicalTeam?.format ?? 'Unknown'}`

        if (!byPlayer[aggregateKey]) {
          byPlayer[aggregateKey] = {
            playerId: pid,

            name: stat.players?.name ?? 'Unknown',
            team: historicalTeam?.name ?? '',
            format: historicalTeam?.format ?? '',

            games: 0,

            goals: 0,
            assists: 0,
            saves: 0,
            shots: 0,

            score: 0,
            mvps: 0,

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

            shPct: 0,
            demoRatio: 0,

            goalsPerGame: 0,
            assistsPerGame: 0,
            savesPerGame: 0,

            samples: {
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
            },
          }
        }

        const row = byPlayer[aggregateKey]

        // -------------------------------------------------------------------
        // Box-score stats
        // -------------------------------------------------------------------

        row.games += 1

        row.goals += Number(stat.goals ?? 0)
        row.assists += Number(stat.assists ?? 0)
        row.saves += Number(stat.saves ?? 0)
        row.shots += Number(stat.shots ?? 0)
        row.score += Number(stat.score ?? 0)

        if (stat.mvp) {
          row.mvps += 1
        }

        // -------------------------------------------------------------------
        // Stats where we need to know whether data actually existed
        // -------------------------------------------------------------------

        if (hasValue(stat.bpm)) {
          row.bpm += Number(stat.bpm)
          row.samples.bpm += 1
        }

        if (hasValue(stat.avg_speed)) {
          row.avgSpeed += Number(stat.avg_speed)
          row.samples.avgSpeed += 1
        }

        if (
          hasValue(stat.demos_inflicted) ||
          hasValue(stat.demos_taken)
        ) {
          row.demosInflicted += Number(stat.demos_inflicted ?? 0)
          row.demosTaken += Number(stat.demos_taken ?? 0)
          row.samples.demos += 1
        }

        if (
          hasValue(stat.boost_collected) ||
          hasValue(stat.boost_stolen)
        ) {
          row.boostCollected += Number(stat.boost_collected ?? 0)
          row.boostStolen += Number(stat.boost_stolen ?? 0)
          row.samples.boost += 1
        }

        // -------------------------------------------------------------------
        // Detailed Process Skills percentage data
        // -------------------------------------------------------------------

        if (hasValue(stat.percentage_supersonic_speed)) {
          row.supersonicPct += Number(stat.percentage_supersonic_speed)
          row.samples.supersonic += 1
        }

        if (hasValue(stat.percentage_on_ground)) {
          row.groundPct += Number(stat.percentage_on_ground)
          row.samples.ground += 1
        }

        if (hasValue(stat.percentage_low_air)) {
          row.lowAirPct += Number(stat.percentage_low_air)
          row.samples.lowAir += 1
        }

        if (hasValue(stat.percentage_high_air)) {
          row.highAirPct += Number(stat.percentage_high_air)
          row.samples.highAir += 1
        }

        if (hasValue(stat.percentage_defensive_third)) {
          row.defensiveThirdPct += Number(stat.percentage_defensive_third)
          row.samples.defensiveThird += 1
        }

        if (hasValue(stat.percentage_neutral_third)) {
          row.neutralThirdPct += Number(stat.percentage_neutral_third)
          row.samples.neutralThird += 1
        }

        if (hasValue(stat.percentage_offensive_third)) {
          row.offensiveThirdPct += Number(stat.percentage_offensive_third)
          row.samples.offensiveThird += 1
        }

        if (hasValue(stat.percentage_most_back)) {
          row.mostBackPct += Number(stat.percentage_most_back)
          row.samples.mostBack += 1
        }

        if (hasValue(stat.percentage_most_forward)) {
          row.mostForwardPct += Number(stat.percentage_most_forward)
          row.samples.mostForward += 1
        }

        if (hasValue(stat.percentage_behind_ball)) {
          row.behindBallPct += Number(stat.percentage_behind_ball)
          row.samples.behindBall += 1
        }

        if (hasValue(stat.percentage_in_front_of_ball)) {
          row.inFrontOfBallPct += Number(stat.percentage_in_front_of_ball)
          row.samples.inFrontBall += 1
        }

        if (hasValue(stat.percentage_defensive_half)) {
          row.defensiveHalfPct += Number(stat.percentage_defensive_half)
          row.samples.defensiveHalf += 1
        }

        if (hasValue(stat.percentage_offensive_half)) {
          row.offensiveHalfPct += Number(stat.percentage_offensive_half)
          row.samples.offensiveHalf += 1
        }

        // -------------------------------------------------------------------
        // Detailed positioning distances
        // -------------------------------------------------------------------

        if (hasValue(stat.avg_distance_to_ball)) {
          row.avgDistanceToBall += Number(stat.avg_distance_to_ball)
          row.samples.distanceBall += 1
        }

        if (hasValue(stat.avg_distance_to_ball_has_possession)) {
          row.avgDistanceToBallHasPossession += Number(
            stat.avg_distance_to_ball_has_possession
          )

          row.samples.distancePossession += 1
        }

        if (hasValue(stat.avg_distance_to_ball_no_possession)) {
          row.avgDistanceToBallNoPossession += Number(
            stat.avg_distance_to_ball_no_possession
          )

          row.samples.distanceNoPossession += 1
        }

        if (hasValue(stat.avg_distance_to_teammates)) {
          row.avgDistanceToTeammates += Number(
            stat.avg_distance_to_teammates
          )

          row.samples.distanceTeammates += 1
        }

        // -------------------------------------------------------------------
        // Zero Boost
        // -------------------------------------------------------------------

        if (hasValue(stat.zero_boost_pct)) {
          row.zeroBoostPct += Number(stat.zero_boost_pct)
          row.samples.zeroBoost += 1
        }
      })

      const finishedRows: Row[] = Object.values(byPlayer).map((row, index) => {
        // The domain identity is player + historical team + format. The numeric
        // key is local to this rendered leaderboard and avoids collisions when
        // one player appears for multiple squads or formats.
        row.playerId = index + 1
        // -------------------------------------------------------------------
        // Average only games where that stat actually existed
        // -------------------------------------------------------------------

        row.bpm = avg(
          row.bpm,
          row.samples.bpm
        )

        row.avgSpeed = avg(
          row.avgSpeed,
          row.samples.avgSpeed
        )

        row.supersonicPct = avg(
          row.supersonicPct,
          row.samples.supersonic
        )

        row.groundPct = avg(
          row.groundPct,
          row.samples.ground
        )

        row.lowAirPct = avg(
          row.lowAirPct,
          row.samples.lowAir
        )

        row.highAirPct = avg(
          row.highAirPct,
          row.samples.highAir
        )

        row.defensiveThirdPct = avg(
          row.defensiveThirdPct,
          row.samples.defensiveThird
        )

        row.neutralThirdPct = avg(
          row.neutralThirdPct,
          row.samples.neutralThird
        )

        row.offensiveThirdPct = avg(
          row.offensiveThirdPct,
          row.samples.offensiveThird
        )

        row.mostBackPct = avg(
          row.mostBackPct,
          row.samples.mostBack
        )

        row.mostForwardPct = avg(
          row.mostForwardPct,
          row.samples.mostForward
        )

        row.behindBallPct = avg(
          row.behindBallPct,
          row.samples.behindBall
        )

        row.inFrontOfBallPct = avg(
          row.inFrontOfBallPct,
          row.samples.inFrontBall
        )

        row.defensiveHalfPct = avg(
          row.defensiveHalfPct,
          row.samples.defensiveHalf
        )

        row.offensiveHalfPct = avg(
          row.offensiveHalfPct,
          row.samples.offensiveHalf
        )

        row.avgDistanceToBall = avg(
          row.avgDistanceToBall,
          row.samples.distanceBall
        )

        row.avgDistanceToBallHasPossession = avg(
          row.avgDistanceToBallHasPossession,
          row.samples.distancePossession
        )

        row.avgDistanceToBallNoPossession = avg(
          row.avgDistanceToBallNoPossession,
          row.samples.distanceNoPossession
        )

        row.avgDistanceToTeammates = avg(
          row.avgDistanceToTeammates,
          row.samples.distanceTeammates
        )

        row.zeroBoostPct = avg(
          row.zeroBoostPct,
          row.samples.zeroBoost
        )

        // -------------------------------------------------------------------
        // Standard derived stats
        // -------------------------------------------------------------------

        row.shPct =
          row.shots > 0
            ? (row.goals / row.shots) * 100
            : 0

        row.demoRatio =
          row.demosTaken > 0
            ? row.demosInflicted / row.demosTaken
            : row.demosInflicted

        row.goalsPerGame =
          row.games > 0
            ? row.goals / row.games
            : 0

        row.assistsPerGame =
          row.games > 0
            ? row.assists / row.games
            : 0

        row.savesPerGame =
          row.games > 0
            ? row.saves / row.games
            : 0

        // -------------------------------------------------------------------
        // Tell processSkills.ts which categories actually contain data
        // -------------------------------------------------------------------

        const dataAvailability = {
          demoEfficiency:
            row.samples.demos > 0,

          shotQuality:
            row.games > 0,

          boostStealRate:
            row.samples.boost > 0,

          bpm:
            row.samples.bpm > 0,

          avgSpeed:
            row.samples.avgSpeed > 0,

          supersonicPct:
            row.samples.supersonic > 0,

          airTimePct:
            row.samples.lowAir > 0 &&
            row.samples.highAir > 0,

          positioningDepth:
            row.samples.defensiveThird > 0 &&
            row.samples.behindBall > 0 &&
            row.samples.mostBack > 0 &&
            row.samples.defensiveHalf > 0,

          zeroBoostPct:
            row.samples.zeroBoost > 0,
        }

        const { samples, ...finished } = row

        return {
          ...finished,
          dataAvailability,
        }
      })

      setRows(finishedRows)
      setLoading(false)
    }

    load()
  }, [])

  // ---------------------------------------------------------------------------
  // Team / format filter lists
  // ---------------------------------------------------------------------------

  const teams = useMemo(() => {
    return [
      'All',
      ...Array.from(
        new Set(
          rows
            .map((row) => row.team)
            .filter(Boolean)
        )
      ),
    ]
  }, [rows])

  const formats = useMemo(() => {
    return [
      'All',
      ...Array.from(
        new Set(
          rows
            .map((row) => row.format)
            .filter(Boolean)
        )
      ),
    ]
  }, [rows])

  // ---------------------------------------------------------------------------
  // Base filtering
  // ---------------------------------------------------------------------------

  const filterBase = useMemo(() => {
    return rows
      .filter(
        (row) =>
          teamFilter === 'All' ||
          row.team === teamFilter
      )
      .filter(
        (row) =>
          formatFilter === 'All' ||
          row.format === formatFilter
      )
  }, [
    rows,
    teamFilter,
    formatFilter,
  ])

  // ---------------------------------------------------------------------------
  // Box Score filtering / sorting
  // ---------------------------------------------------------------------------

  const filteredBox = useMemo(() => {
    return [...filterBase]
      .filter((row) =>
        row.name
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
      )
      .sort((a, b) => {
        const aValue = a[sortKey]
        const bValue = b[sortKey]

        let comparison = 0

        if (
          typeof aValue === 'string' ||
          typeof bValue === 'string'
        ) {
          comparison =
            String(aValue).localeCompare(
              String(bValue)
            )
        } else {
          comparison =
            Number(aValue) -
            Number(bValue)
        }

        return sortDir === 'asc'
          ? comparison
          : -comparison
      })
  }, [
    filterBase,
    search,
    sortKey,
    sortDir,
  ])

  // ---------------------------------------------------------------------------
  // Process Skills player objects
  // ---------------------------------------------------------------------------

  const processPlayers = useMemo(() => {
    return filterBase.map(
      (row): ProcessPlayer => ({
        playerId: row.playerId,

        name: row.name,
        team: row.team,
        format: row.format,

        games: row.games,

        goals: row.goals,
        assists: row.assists,
        saves: row.saves,
        shots: row.shots,

        bpm: row.bpm,
        avgSpeed: row.avgSpeed,

        demosInflicted:
          row.demosInflicted,

        demosTaken:
          row.demosTaken,

        boostCollected:
          row.boostCollected,

        boostStolen:
          row.boostStolen,

        supersonicPct:
          row.supersonicPct,

        groundPct:
          row.groundPct,

        lowAirPct:
          row.lowAirPct,

        highAirPct:
          row.highAirPct,

        defensiveThirdPct:
          row.defensiveThirdPct,

        neutralThirdPct:
          row.neutralThirdPct,

        offensiveThirdPct:
          row.offensiveThirdPct,

        mostBackPct:
          row.mostBackPct,

        mostForwardPct:
          row.mostForwardPct,

        behindBallPct:
          row.behindBallPct,

        inFrontOfBallPct:
          row.inFrontOfBallPct,

        defensiveHalfPct:
          row.defensiveHalfPct,

        offensiveHalfPct:
          row.offensiveHalfPct,

        avgDistanceToBall:
          row.avgDistanceToBall,

        avgDistanceToBallHasPossession:
          row.avgDistanceToBallHasPossession,

        avgDistanceToBallNoPossession:
          row.avgDistanceToBallNoPossession,

        avgDistanceToTeammates:
          row.avgDistanceToTeammates,

        zeroBoostPct:
          row.zeroBoostPct,

        dataAvailability:
          row.dataAvailability,
      })
    )
  }, [filterBase])

  const processResults = useMemo(
    () =>
      buildProcessSkillResults(
        processPlayers
      ),
    [processPlayers]
  )

  const eligibilityThreshold = useMemo(
    () =>
      getEligibilityThreshold(
        processPlayers
      ),
    [processPlayers]
  )

  const searchedProcessResults = useMemo(
    () =>
      processResults.filter(
        (player) =>
          player.name
            .toLowerCase()
            .includes(
              search.toLowerCase()
            )
      ),
    [
      processResults,
      search,
    ]
  )

  const ineligiblePlayers = useMemo(
    () =>
      getIneligiblePlayers(
        searchedProcessResults
      ),
    [
      searchedProcessResults,
    ]
  )

  const medalTable = useMemo(
    () =>
      calculateMedalTable(
        processResults
      ),
    [processResults]
  )

  // ---------------------------------------------------------------------------
  // Rate Stats grouping
  // ---------------------------------------------------------------------------

  const rateGroups = useMemo(() => {
    const groups: Record<
      string,
      typeof processResults
    > = {}

    searchedProcessResults
      .filter(
        (player) =>
          player.eligible
      )
      .forEach((player) => {
        const key =
          `${player.team} — ${player.format}`

        if (!groups[key]) {
          groups[key] = []
        }

        groups[key].push(
          player
        )
      })

    return groups
  }, [
    searchedProcessResults,
  ])

  // ---------------------------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------------------------

  function handleSort(
    key: SortKey
  ) {
    if (sortKey === key) {
      setSortDir(
        sortDir === 'asc'
          ? 'desc'
          : 'asc'
      )
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const columns: {
    key: SortKey
    label: string
  }[] = [
    {
      key: 'name',
      label: 'Player',
    },
    {
      key: 'team',
      label: 'Team',
    },
    {
      key: 'format',
      label: 'Format',
    },
    {
      key: 'games',
      label: 'GP',
    },

    {
      key: 'goals',
      label: 'G',
    },
    {
      key: 'goalsPerGame',
      label: 'G/GP',
    },

    {
      key: 'assists',
      label: 'A',
    },
    {
      key: 'assistsPerGame',
      label: 'A/GP',
    },

    {
      key: 'saves',
      label: 'SV',
    },
    {
      key: 'savesPerGame',
      label: 'SV/GP',
    },

    {
      key: 'shots',
      label: 'SH',
    },
    {
      key: 'shPct',
      label: 'SH%',
    },

    {
      key: 'score',
      label: 'Score',
    },
    {
      key: 'mvps',
      label: 'MVP',
    },

    {
      key: 'bpm',
      label: 'BPM',
    },
    {
      key: 'avgSpeed',
      label: 'Speed',
    },
    {
      key: 'demoRatio',
      label: 'Demo Ratio',
    },
  ]

  // ---------------------------------------------------------------------------
  // Medal display
  // ---------------------------------------------------------------------------

  function renderMedalCell(
    skill: ProcessSkillKey,
    rank: number
  ) {
    const medalists =
      getMedalists(
        processResults,
        skill
      ).filter(
        (player) =>
          player.rank === rank
      )

    if (
      medalists.length === 0
    ) {
      return (
        <span className="text-neutral-700">
          —
        </span>
      )
    }

    return (
      <div className="space-y-2">
        {medalists.map(
          (player) => (
            <div
              key={
                player.playerId
              }
            >
              <a
                href={`/players/${encodeURIComponent(
                  player.name
                )}`}
                className="font-semibold text-white hover:underline"
              >
                {
                  player.name
                }
              </a>

              <div className="text-xs text-neutral-500">
                {formatProcessSkillValue(
                  skill,
                  player[
                    skill
                  ]
                )}
              </div>
            </div>
          )
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  return (
    <main className="px-4 md:px-8 py-12 max-w-7xl mx-auto">
      <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-2">
        Stats &{' '}
        <span
          style={{
            color:
              '#AF69EE',
          }}
        >
          Medals
        </span>
      </h1>

      <p className="text-neutral-500 mb-8">
        Every stat, every
        game, fully sortable
      </p>

      {/* FILTERS */}

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          placeholder="Search player..."
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
          className="bg-[#1b1b1b] border border-neutral-800 rounded-lg px-4 py-2 text-sm text-white placeholder-neutral-600"
        />

        <select
          value={teamFilter}
          onChange={(e) =>
            setTeamFilter(
              e.target.value
            )
          }
          className="bg-[#1b1b1b] border border-neutral-800 rounded-lg px-4 py-2 text-sm text-white"
        >
          {teams.map(
            (team) => (
              <option
                key={team}
                value={team}
              >
                {team ===
                'All'
                  ? 'All Teams'
                  : team}
              </option>
            )
          )}
        </select>

        <select
          value={
            formatFilter
          }
          onChange={(e) =>
            setFormatFilter(
              e.target.value
            )
          }
          className="bg-[#1b1b1b] border border-neutral-800 rounded-lg px-4 py-2 text-sm text-white"
        >
          {formats.map(
            (format) => (
              <option
                key={format}
                value={format}
              >
                {format ===
                'All'
                  ? 'All Formats'
                  : format}
              </option>
            )
          )}
        </select>
      </div>

      {/* VIEW SWITCH */}

      <div className="flex gap-2 mb-8">
        <button
          onClick={() =>
            setView('box')
          }
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            view === 'box'
              ? 'bg-purple-700 text-white'
              : 'bg-[#1b1b1b] text-neutral-400'
          }`}
        >
          Box Score
        </button>

        <button
          onClick={() =>
            setView(
              'process'
            )
          }
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            view ===
            'process'
              ? 'bg-purple-700 text-white'
              : 'bg-[#1b1b1b] text-neutral-400'
          }`}
        >
          Process Skills
        </button>
      </div>

      {loading && (
        <p className="text-neutral-500">
          Loading stats...
        </p>
      )}

      {loadError && (
        <div className="border border-red-900 bg-red-950/20 rounded-xl p-4 text-red-400">
          Failed to load
          stats:{' '}
          {loadError}
        </div>
      )}

      {!loading &&
        !loadError &&
        filteredBox.length ===
          0 && (
          <p className="text-neutral-500">
            No players
            match.
          </p>
        )}

      {/* =============================================================== */}
      {/* BOX SCORE                                                       */}
      {/* =============================================================== */}

      {!loading &&
        !loadError &&
        view === 'box' &&
        filteredBox.length >
          0 && (
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full text-sm min-w-[1200px]">
              <thead>
                <tr className="bg-[#1b1b1b] text-neutral-400 text-xs uppercase tracking-wide">
                  {columns.map(
                    (
                      column
                    ) => (
                      <th
                        key={
                          column.key
                        }
                        onClick={() =>
                          handleSort(
                            column.key
                          )
                        }
                        className="px-4 py-3 text-left cursor-pointer hover:text-white select-none whitespace-nowrap"
                      >
                        {
                          column.label
                        }{' '}
                        {sortKey ===
                          column.key &&
                          (sortDir ===
                          'asc'
                            ? '▲'
                            : '▼')}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredBox.map(
                  (row) => (
                    <tr
                      key={
                        row.playerId
                      }
                      className="border-t border-neutral-800 hover:bg-[#161616]"
                    >
                      <td className="px-4 py-3">
                        <a
                          href={`/players/${encodeURIComponent(
                            row.name
                          )}`}
                          className="font-semibold text-white hover:underline"
                        >
                          {
                            row.name
                          }
                        </a>
                      </td>

                      <td className="px-4 py-3 text-neutral-400">
                        {
                          row.team
                        }
                      </td>

                      <td className="px-4 py-3 text-neutral-500">
                        {
                          row.format
                        }
                      </td>

                      <td className="px-4 py-3">
                        {
                          row.games
                        }
                      </td>

                      <td
                        className="px-4 py-3 font-semibold"
                        style={{
                          color:
                            '#AF69EE',
                        }}
                      >
                        {
                          row.goals
                        }
                      </td>

                      <td className="px-4 py-3">
                        {row.goalsPerGame.toFixed(
                          2
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {
                          row.assists
                        }
                      </td>

                      <td className="px-4 py-3">
                        {row.assistsPerGame.toFixed(
                          2
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {
                          row.saves
                        }
                      </td>

                      <td className="px-4 py-3">
                        {row.savesPerGame.toFixed(
                          2
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {
                          row.shots
                        }
                      </td>

                      <td className="px-4 py-3">
                        {row.shPct.toFixed(
                          1
                        )}
                        %
                      </td>

                      <td className="px-4 py-3">
                        {
                          row.score
                        }
                      </td>

                      <td className="px-4 py-3">
                        {
                          row.mvps
                        }
                      </td>

                      <td className="px-4 py-3">
                        {Math.round(
                          row.bpm
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {Math.round(
                          row.avgSpeed
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {row.demoRatio.toFixed(
                          2
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

      {/* =============================================================== */}
      {/* PROCESS SKILLS                                                  */}
      {/* =============================================================== */}

      {!loading &&
        !loadError &&
        view === 'process' &&
        formatFilter === 'All' && (
          <section className="rounded-xl border border-purple-900/50 bg-purple-950/10 p-6">
            <h2 className="text-xl font-bold text-white">Choose a competitive format</h2>
            <p className="mt-2 max-w-2xl text-sm text-neutral-400">
              Process Skill rankings are format-specific because 2v2 and 3v3 create different roles, spacing, and statistical environments. Select a recorded format above to view fair org rankings and medals.
            </p>
          </section>
        )}

      {!loading &&
        !loadError &&
        view ===
          'process' &&
        formatFilter !== 'All' &&
        processResults.length >
          0 && (
          <div className="space-y-8">

            {/* PROCESS SKILLS MEDALS */}

            <section className="rounded-xl border border-neutral-800 bg-[#111111] overflow-hidden">
              <div className="p-5 border-b border-neutral-800 flex flex-wrap justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    Process
                    Skills
                  </h2>

                  <p className="text-sm text-neutral-500 mt-1">
                    Flop Reset
                    medal
                    rankings based
                    on detailed
                    Ballchasing
                    data.
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-neutral-500">
                    Eligibility
                  </div>

                  <div className="text-lg font-bold">
                    {
                      eligibilityThreshold
                    }{' '}
                    GP
                  </div>

                  <div className="text-xs text-neutral-600">
                    20% of
                    highest game
                    count
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-sm">
                  <thead>
                    <tr className="bg-[#1b1b1b] text-neutral-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">
                        Category
                      </th>

                      <th className="px-4 py-3 text-left">
                        🥇 Gold
                      </th>

                      <th className="px-4 py-3 text-left">
                        🥈
                        Silver
                      </th>

                      <th className="px-4 py-3 text-left">
                        🥉
                        Bronze
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {PROCESS_SKILLS.map(
                      (
                        skill
                      ) => (
                        <tr
                          key={
                            skill.key
                          }
                          className="border-t border-neutral-800"
                        >
                          <td className="px-4 py-4">
                            <div className="font-semibold">
                              {
                                skill.label
                              }
                            </div>

                            <div className="text-xs text-neutral-600 mt-1 max-w-xs">
                              {
                                skill.description
                              }
                            </div>

                            {skill.key ===
                              'positioningDepth' && (
                              <div className="text-xs text-purple-400/70 mt-1">
                                Higher
                                =
                                deeper
                                positioning,
                                not
                                necessarily
                                better.
                              </div>
                            )}

                            {skill.direction ===
                              'lower' && (
                              <div className="text-xs text-green-500/70 mt-1">
                                Lower
                                is
                                better
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-4 align-top">
                            {renderMedalCell(
                              skill.key,
                              1
                            )}
                          </td>

                          <td className="px-4 py-4 align-top">
                            {renderMedalCell(
                              skill.key,
                              2
                            )}
                          </td>

                          <td className="px-4 py-4 align-top">
                            {renderMedalCell(
                              skill.key,
                              3
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* MEDAL TABLE */}

            {medalTable.length >
              0 && (
              <section className="rounded-xl border border-neutral-800 bg-[#111111] overflow-hidden">
                <div className="p-5 border-b border-neutral-800">
                  <h2 className="text-xl font-bold">
                    Medal
                    Table
                  </h2>

                  <p className="text-sm text-neutral-500 mt-1">
                    Total
                    Process
                    Skills
                    medals
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1b1b1b] text-neutral-400 text-xs uppercase tracking-wide">
                        <th className="px-4 py-3 text-left">
                          Player
                        </th>

                        <th className="px-4 py-3 text-left">
                          Team
                        </th>

                        <th className="px-4 py-3 text-center">
                          🥇
                        </th>

                        <th className="px-4 py-3 text-center">
                          🥈
                        </th>

                        <th className="px-4 py-3 text-center">
                          🥉
                        </th>

                        <th className="px-4 py-3 text-center">
                          Total
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {medalTable.map(
                        (
                          player
                        ) => (
                          <tr
                            key={
                              player.playerId
                            }
                            className="border-t border-neutral-800"
                          >
                            <td className="px-4 py-3">
                              <a
                                href={`/players/${encodeURIComponent(
                                  player.name
                                )}`}
                                className="font-semibold text-white hover:underline"
                              >
                                {
                                  player.name
                                }
                              </a>
                            </td>

                            <td className="px-4 py-3 text-neutral-500">
                              {
                                player.team
                              }
                            </td>

                            <td className="px-4 py-3 text-center">
                              {
                                player.gold
                              }
                            </td>

                            <td className="px-4 py-3 text-center">
                              {
                                player.silver
                              }
                            </td>

                            <td className="px-4 py-3 text-center">
                              {
                                player.bronze
                              }
                            </td>

                            <td className="px-4 py-3 text-center font-bold">
                              {
                                player.total
                              }
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* RATE STATS */}

            <section className="rounded-xl border border-neutral-800 bg-[#111111]">
              <div className="p-5 border-b border-neutral-800">
                <h2 className="text-xl font-bold">
                  Rate Stats
                </h2>

                <p className="text-sm text-neutral-500 mt-1">
                  Goals,
                  assists, and
                  saves per
                  game
                </p>
              </div>

              <div className="p-5 space-y-8">
                {Object.entries(
                  rateGroups
                ).map(
                  ([
                    groupName,
                    players,
                  ]) => (
                    <div
                      key={
                        groupName
                      }
                    >
                      <h3 className="text-lg font-bold mb-3">
                        {
                          groupName
                        }
                      </h3>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs uppercase tracking-wide text-neutral-500">
                              <th className="text-left py-2">
                                Player
                              </th>

                              <th className="text-left py-2">
                                GP
                              </th>

                              {RATE_STATS.map(
                                (
                                  stat
                                ) => (
                                  <th
                                    key={
                                      stat.key
                                    }
                                    className="text-left py-2"
                                  >
                                    {
                                      stat.shortLabel
                                    }
                                  </th>
                                )
                              )}
                            </tr>
                          </thead>

                          <tbody>
                            {players.map(
                              (
                                player
                              ) => (
                                <tr
                                  key={
                                    player.playerId
                                  }
                                  className="border-t border-neutral-800"
                                >
                                  <td className="py-3">
                                    <a
                                      href={`/players/${encodeURIComponent(
                                        player.name
                                      )}`}
                                      className="font-semibold text-white hover:underline"
                                    >
                                      {
                                        player.name
                                      }
                                    </a>
                                  </td>

                                  <td className="py-3">
                                    {
                                      player.games
                                    }
                                  </td>

                                  {RATE_STATS.map(
                                    (
                                      stat
                                    ) => (
                                      <td
                                        key={
                                          stat.key
                                        }
                                        className="py-3"
                                      >
                                        {formatRateStat(
                                          player[
                                            stat.key
                                          ]
                                        )}
                                      </td>
                                    )
                                  )}
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>

            {/* INELIGIBLE PLAYERS */}

            {ineligiblePlayers.length >
              0 && (
              <section className="rounded-xl border border-neutral-800 bg-[#111111] overflow-hidden">
                <div className="p-5 border-b border-neutral-800">
                  <h2 className="text-xl font-bold">
                    Ineligible
                    Players
                  </h2>

                  <p className="text-sm text-neutral-500 mt-1">
                    Players
                    below the
                    current{' '}
                    {
                      eligibilityThreshold
                    }
                    -game
                    minimum.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1b1b1b] text-neutral-400 text-xs uppercase tracking-wide">
                        <th className="px-4 py-3 text-left">
                          Player
                        </th>

                        <th className="px-4 py-3 text-left">
                          Team
                        </th>

                        <th className="px-4 py-3 text-left">
                          Format
                        </th>

                        <th className="px-4 py-3 text-left">
                          GP
                        </th>

                        <th className="px-4 py-3 text-left">
                          Required
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {ineligiblePlayers.map(
                        (
                          player
                        ) => (
                          <tr
                            key={
                              player.playerId
                            }
                            className="border-t border-neutral-800"
                          >
                            <td className="px-4 py-3">
                              {
                                player.name
                              }
                            </td>

                            <td className="px-4 py-3 text-neutral-500">
                              {
                                player.team
                              }
                            </td>

                            <td className="px-4 py-3 text-neutral-500">
                              {
                                player.format
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                player.games
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                eligibilityThreshold
                              }
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
    </main>
  )
}
