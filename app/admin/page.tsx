/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase'
import { parseLeagueMatches } from '@/lib/parseLeagueMatches'
import { formatCompetitionAdminLabel } from '@/lib/competitions'

type Competition = {
  id: number
  name: string
  format: string
}

type RosterPlayer = {
  player_id: number
  name: string
  aliases?: string[] | null
}

type Game = {
  replayId: string
  date: string
  ourGoals: number
  theirGoals: number
}

type PlayerStat = {
  replayId: string
  playerId: number
  playerName: string

  goals: number
  assists: number
  saves: number
  shots: number
  score: number

  bpm: number | null
  avgSpeed: number | null

  timeSupersonic: number | null
  timeOnGround: number | null
  timeLowAir: number | null
  timeHighAir: number | null

  timeDefensiveThird: number | null
  timeNeutralThird: number | null
  timeOffensiveThird: number | null

  percentageSupersonicSpeed: number | null
  percentageOnGround: number | null
  percentageLowAir: number | null
  percentageHighAir: number | null

  percentageDefensiveThird: number | null
  percentageNeutralThird: number | null
  percentageOffensiveThird: number | null

  percentageMostBack: number | null
  percentageMostForward: number | null
  percentageBehindBall: number | null
  percentageInFrontOfBall: number | null

  percentageDefensiveHalf: number | null
  percentageOffensiveHalf: number | null

  avgDistanceToBall: number | null
  avgDistanceToBallHasPossession: number | null
  avgDistanceToBallNoPossession: number | null
  avgDistanceToTeammates: number | null

  demosInflicted: number | null
  demosTaken: number | null

  boostCollected: number | null
  boostStolen: number | null

  zeroBoostTime: number | null
  zeroBoostPct: number | null
}

type ImportMode =
  | 'new'
  | 'checking'
  | 'backfill'
  | 'conflict'

type MatchMapping = {
  replayId: string
  matchId: number
}

type ExistingMatch = {
  match_id: number
  flop_reset_score: number
  opponent_score: number
  replay_id: string | null
}

type ExistingPlayerStat = {
  stat_id: number
  match_id: number
  player_id: number
  goals: number | null
  assists: number | null
  saves: number | null
  shots: number | null
  score: number | null
}

function numberFrom(
  row: Record<string, any>,
  ...keys: string[]
): number {
  for (const key of keys) {
    const raw = row[key]

    if (
      raw !== undefined &&
      raw !== null &&
      raw !== ''
    ) {
      const value = Number(raw)

      if (Number.isFinite(value)) {
        return value
      }
    }
  }

  return 0
}

function nullableNumberFrom(
  row: Record<string, any>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const raw = row[key]
    if (raw === undefined || raw === null || raw === '') continue
    const value = Number(raw)
    if (Number.isFinite(value)) return value
  }
  return null
}

function textFrom(
  row: Record<string, any>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = row[key]

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {
      return String(value).trim()
    }
  }

  return ''
}

function processSkillUpdate(stat: PlayerStat) {
  return {
    bpm: stat.bpm,
    avg_speed: stat.avgSpeed,

    time_supersonic: stat.timeSupersonic,
    time_on_ground: stat.timeOnGround,
    time_low_air: stat.timeLowAir,
    time_high_air: stat.timeHighAir,

    time_defensive_third: stat.timeDefensiveThird,
    time_neutral_third: stat.timeNeutralThird,
    time_offensive_third: stat.timeOffensiveThird,

    percentage_supersonic_speed:
      stat.percentageSupersonicSpeed,

    percentage_on_ground:
      stat.percentageOnGround,

    percentage_low_air:
      stat.percentageLowAir,

    percentage_high_air:
      stat.percentageHighAir,

    percentage_defensive_third:
      stat.percentageDefensiveThird,

    percentage_neutral_third:
      stat.percentageNeutralThird,

    percentage_offensive_third:
      stat.percentageOffensiveThird,

    percentage_most_back:
      stat.percentageMostBack,

    percentage_most_forward:
      stat.percentageMostForward,

    percentage_behind_ball:
      stat.percentageBehindBall,

    percentage_in_front_of_ball:
      stat.percentageInFrontOfBall,

    percentage_defensive_half:
      stat.percentageDefensiveHalf,

    percentage_offensive_half:
      stat.percentageOffensiveHalf,

    avg_distance_to_ball:
      stat.avgDistanceToBall,

    avg_distance_to_ball_has_possession:
      stat.avgDistanceToBallHasPossession,

    avg_distance_to_ball_no_possession:
      stat.avgDistanceToBallNoPossession,

    avg_distance_to_teammates:
      stat.avgDistanceToTeammates,

    demos_inflicted:
      stat.demosInflicted,

    demos_taken:
      stat.demosTaken,

    boost_collected:
      stat.boostCollected,

    boost_stolen:
      stat.boostStolen,

    zero_boost_time:
      stat.zeroBoostTime,

    zero_boost_pct:
      stat.zeroBoostPct,
  }
}

export default function Admin() {
  const router = useRouter()

  const [tab, setTab] = useState<
    'add' |
    'import' |
    'schedule' |
    'rankings' |
    'manage'
  >('add')

  // ---------------------------------------------------------------------------
  // Shared
  // ---------------------------------------------------------------------------

  const [competitions, setCompetitions] =
    useState<Competition[]>([])

  // ---------------------------------------------------------------------------
  // Add Result
  // ---------------------------------------------------------------------------

  const [competitionId, setCompetitionId] =
    useState('')

  const [teamName, setTeamName] =
    useState('Frameshift')

  const [opponentName, setOpponentName] =
    useState('')

  const [flopScore, setFlopScore] =
    useState('')

  const [opponentScore, setOpponentScore] =
    useState('')

  const [matchDate, setMatchDate] =
    useState('')

  const [isForfeit, setIsForfeit] =
    useState(false)

  const [forfeitResult, setForfeitResult] =
    useState<'win' | 'loss'>('win')

  const [matchRound, setMatchRound] =
    useState('')

  const [message, setMessage] =
    useState('')

  // ---------------------------------------------------------------------------
  // CSV Import
  // ---------------------------------------------------------------------------

  const [
    importCompetitionId,
    setImportCompetitionId,
  ] = useState('')

  const [importTeam, setImportTeam] =
    useState('Frameshift')

  const [importOpponent, setImportOpponent] =
    useState('')

  const [importDate, setImportDate] =
    useState('')

  const [importBestOf, setImportBestOf] =
    useState('')

  const [games, setGames] =
    useState<Game[]>([])

  const [playerStats, setPlayerStats] =
    useState<PlayerStat[]>([])

  const [
    rosterPlayers,
    setRosterPlayers,
  ] = useState<RosterPlayer[]>([])

  const [importMessage, setImportMessage] =
    useState('')

  const [
    unmatchedPlayers,
    setUnmatchedPlayers,
  ] = useState<string[]>([])

  const [importMode, setImportMode] =
    useState<ImportMode>('new')

  const [
    existingSeriesId,
    setExistingSeriesId,
  ] = useState<number | null>(null)

  const [
    existingSeriesMessage,
    setExistingSeriesMessage,
  ] = useState('')

  const [
    backfillMappings,
    setBackfillMappings,
  ] = useState<MatchMapping[]>([])

  // ---------------------------------------------------------------------------
  // Schedule
  // ---------------------------------------------------------------------------

  const [
    scheduleTeamName,
    setScheduleTeamName,
  ] = useState('Frameshift')

  const [
    scheduleCompetitionId,
    setScheduleCompetitionId,
  ] = useState('')

  const [
    scheduleOpponent,
    setScheduleOpponent,
  ] = useState('')

  const [
    scheduleDate,
    setScheduleDate,
  ] = useState('')

  const [
    scheduleTime,
    setScheduleTime,
  ] = useState('')

  const [
    scheduleNotes,
    setScheduleNotes,
  ] = useState('')

  const [
    scheduleMessage,
    setScheduleMessage,
  ] = useState('')

  const [
    scheduledList,
    setScheduledList,
  ] = useState<any[]>([])

  // ---------------------------------------------------------------------------
  // Power Rankings
  // ---------------------------------------------------------------------------

  const [prFormat, setPrFormat] =
    useState('3v3')

  const [prText, setPrText] =
    useState('')

  const [prMessage, setPrMessage] =
    useState('')

  const [prPreview, setPrPreview] =
    useState<any[]>([])

  // ---------------------------------------------------------------------------
  // Manage
  // ---------------------------------------------------------------------------

  const [
    manageSeries,
    setManageSeries,
  ] = useState<any[]>([])

  const [
    manageBatches,
    setManageBatches,
  ] = useState<
    {
      batch_label: string
      format: string
      count: number
    }[]
  >([])

  const [mvpMatchId, setMvpMatchId] =
    useState('')

  const [
    mvpCandidates,
    setMvpCandidates,
  ] = useState<any[]>([])

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  async function loadScheduled() {
    const { data, error } =
      await supabase
        .from('scheduled_matches')
        .select(`
          scheduled_id,
          opponent_name,
          match_date,
          match_time,
          status,
          teams (
            name,
            format
          )
        `)
        .order(
          'match_date',
          { ascending: true }
        )

    if (error) {
      console.error(error)
      return
    }

    setScheduledList(data ?? [])
  }

  async function loadMvpCandidates(
    matchId: string
  ) {
    if (!matchId) {
      setMvpCandidates([])
      return
    }

    const { data, error } =
      await supabase
        .from('match_player_stats')
        .select(`
          stat_id,
          mvp,
          players (
            name
          )
        `)
        .eq('match_id', matchId)

    if (error) {
      alert(
        `Failed to load players: ${error.message}`
      )
      return
    }

    setMvpCandidates(data ?? [])
  }

  async function setMvp(
    statId: number,
    matchId: string
  ) {
    const { error: clearError } =
      await supabase
        .from('match_player_stats')
        .update({ mvp: false })
        .eq('match_id', matchId)

    if (clearError) {
      alert(clearError.message)
      return
    }

    const { error: setError } =
      await supabase
        .from('match_player_stats')
        .update({ mvp: true })
        .eq('stat_id', statId)

    if (setError) {
      alert(setError.message)
      return
    }

    loadMvpCandidates(matchId)
  }

  async function loadRoster(
    team: string,
    selectedCompetitionId: string
  ) {
    if (
      !team ||
      !selectedCompetitionId
    ) {
      setRosterPlayers([])
      return
    }

    const competition =
      competitions.find(
        (c) =>
          String(c.id) ===
          String(selectedCompetitionId)
      )

    let format =
      competition?.format

    if (!format) {
      const { data } =
        await supabase
          .from('competitions')
          .select('format')
          .eq(
            'id',
            selectedCompetitionId
          )
          .single()

      format = data?.format
    }

    if (!format) {
      setRosterPlayers([])
      return
    }

    const {
      data: teamRow,
      error: teamError,
    } = await supabase
      .from('teams')
      .select('id')
      .eq('name', team)
      .eq('format', format)
      .single()

    if (
      teamError ||
      !teamRow
    ) {
      setRosterPlayers([])
      return
    }

    const {
      data: players,
      error,
    } = await supabase
      .from('players')
      .select(
        'player_id, name, aliases'
      )
      .eq(
        'team_id',
        teamRow.id
      )

    if (error) {
      setRosterPlayers([])
      return
    }

    setRosterPlayers(
      players ?? []
    )
  }

  async function loadManageData() {
    const {
      data: seriesData,
    } = await supabase
      .from('series')
      .select(`
        series_id,
        opponent_name,
        series_date,
        teams (
          name,
          format
        )
      `)
      .order(
        'series_date',
        { ascending: false }
      )

    setManageSeries(
      seriesData ?? []
    )

    const {
      data: batchData,
    } = await supabase
      .from('league_matches')
      .select(
        'batch_label, format'
      )

    const grouped: Record<
      string,
      {
        format: string
        count: number
      }
    > = {}

    batchData?.forEach(
      (row: any) => {
        const key =
          `${row.batch_label}|${row.format}`

        if (!grouped[key]) {
          grouped[key] = {
            format: row.format,
            count: 0,
          }
        }

        grouped[key].count++
      }
    )

    setManageBatches(
      Object.entries(
        grouped
      ).map(
        ([key, value]) => ({
          batch_label:
            key.split('|')[0],

          format:
            value.format,

          count:
            value.count,
        })
      )
    )
  }

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(
        ({ data }) => {
          if (!data.session) {
            router.push('/login')
          }
        }
      )

    async function loadCompetitions() {
      const {
        data,
        error,
      } = await supabase
        .from('competitions')
        .select(
          'id, name, format'
        )
        .order('id')

      if (error) {
        console.error(error)
        return
      }

      const list =
        (data ?? []) as Competition[]

      setCompetitions(list)

      if (list.length) {
        const firstId =
          String(list[0].id)

        setCompetitionId(firstId)
        setImportCompetitionId(firstId)
        setScheduleCompetitionId(firstId)
      }
    }

    loadCompetitions()
    loadScheduled()
    loadManageData()
  }, [router])

  useEffect(() => {
    if (
      importCompetitionId
    ) {
      loadRoster(
        importTeam,
        importCompetitionId
      )
    }
  }, [
    importTeam,
    importCompetitionId,
    competitions,
  ])

  // ---------------------------------------------------------------------------
  // Player matching
  // ---------------------------------------------------------------------------

  function normalizePlayerName(
    value: string
  ) {
    return value
      .trim()
      .toLowerCase()
  }

  function findMatchingPlayer(
    rawName: string,
    roster: RosterPlayer[]
  ): RosterPlayer | null {
    const normalized =
      normalizePlayerName(
        rawName
      )

    const exact =
      roster.find(
        (player) =>
          normalizePlayerName(
            player.name
          ) === normalized
      )

    if (exact) {
      return exact
    }

    const aliasMatch =
      roster.find(
        (player) =>
          (
            player.aliases ??
            []
          ).some(
            (alias) =>
              normalizePlayerName(
                alias
              ) === normalized
          )
      )

    if (aliasMatch) {
      return aliasMatch
    }

    return null
  }

  // ---------------------------------------------------------------------------
  // Import helpers
  // ---------------------------------------------------------------------------

  function resetExistingSeriesCheck() {
    setImportMode('new')
    setExistingSeriesId(null)
    setExistingSeriesMessage('')
    setBackfillMappings([])
  }

  function clearImportPreview() {
    setGames([])
    setPlayerStats([])
    setImportOpponent('')
    setImportDate('')
    setImportBestOf('')
    setUnmatchedPlayers([])

    resetExistingSeriesCheck()
  }

  async function getImportContext(
    selectedCompetitionId = importCompetitionId,
    selectedTeam = importTeam
  ) {
    return resolveCompetitionTeam(selectedCompetitionId, selectedTeam)
  }

  async function resolveCompetitionTeam(selectedCompetitionId: string, selectedTeam: string) {
    const { data: competition, error: competitionError } = await supabase
      .from('competitions')
      .select('id, name, format')
      .eq('id', selectedCompetitionId)
      .single()

    if (competitionError || !competition) throw new Error('Competition not found.')

    const { data: candidates, error: teamError } = await supabase
      .from('teams')
      .select('id, name, format')
      .eq('name', selectedTeam)
      .order('id')

    if (teamError) throw new Error(teamError.message)
    const team = candidates?.find((candidate) => candidate.format === competition.format)
    if (!team) {
      const mismatched = candidates?.[0]
      if (mismatched) throw new Error(`${mismatched.name} (${mismatched.format}) cannot be entered into a ${competition.format} competition.`)
      throw new Error(`${selectedTeam} is not a registered Flop Reset squad.`)
    }

    return { competition, team }
  }

  function statRowsMatch(
    existing: ExistingPlayerStat,
    csv: PlayerStat
  ) {
    return (
      Number(existing.player_id) ===
        Number(csv.playerId) &&

      Number(existing.goals ?? 0) ===
        Number(csv.goals) &&

      Number(existing.assists ?? 0) ===
        Number(csv.assists) &&

      Number(existing.saves ?? 0) ===
        Number(csv.saves) &&

      Number(existing.shots ?? 0) ===
        Number(csv.shots)
    )
  }

  function gameMatchesExistingMatch(
    game: Game,
    existingMatch: ExistingMatch,
    existingStats: ExistingPlayerStat[],
    csvStats: PlayerStat[]
  ) {
    if (
      Number(existingMatch.flop_reset_score) !==
        Number(game.ourGoals) ||
      Number(existingMatch.opponent_score) !==
        Number(game.theirGoals)
    ) {
      return false
    }

    const gameCsvStats =
      csvStats.filter(
        (stat) =>
          stat.replayId ===
          game.replayId
      )

    const gameExistingStats =
      existingStats.filter(
        (stat) =>
          Number(stat.match_id) ===
          Number(existingMatch.match_id)
      )

    if (
      gameExistingStats.length !==
      gameCsvStats.length
    ) {
      return false
    }

    return gameCsvStats.every(
      (csvStat) =>
        gameExistingStats.some(
          (existingStat) =>
            statRowsMatch(
              existingStat,
              csvStat
            )
        )
    )
  }

  async function analyzeExistingSeries(
    parsedGames = games,
    parsedStats = playerStats,
    opponent = importOpponent,
    date = importDate
  ) {
    if (
      !parsedGames.length ||
      !parsedStats.length ||
      !opponent ||
      !date ||
      !importCompetitionId
    ) {
      resetExistingSeriesCheck()
      return
    }

    setImportMode('checking')

    setExistingSeriesMessage(
      'Checking Supabase for an existing series...'
    )

    try {
      const {
        competition,
        team,
      } = await getImportContext()

      const {
        data: candidates,
        error: seriesError,
      } = await supabase
        .from('series')
        .select(
          'series_id, opponent_name, series_date'
        )
        .eq(
          'competition_id',
          competition.id
        )
        .eq(
          'flop_reset_team_id',
          team.id
        )
        .eq(
          'series_date',
          date
        )
        .ilike(
          'opponent_name',
          opponent
        )

      if (seriesError) {
        throw seriesError
      }

      if (
        !candidates ||
        candidates.length === 0
      ) {
        setImportMode('new')

        setExistingSeriesMessage(
          'No matching existing series found. This will be treated as a new import.'
        )

        setExistingSeriesId(null)
        setBackfillMappings([])

        return
      }

      const compatible: {
        seriesId: number
        mappings: MatchMapping[]
      }[] = []

      for (
        const candidate of candidates
      ) {
        const {
          data: existingMatches,
          error: matchesError,
        } = await supabase
          .from('matches')
          .select(`
            match_id,
            flop_reset_score,
            opponent_score,
            replay_id
          `)
          .eq(
            'series_id',
            candidate.series_id
          )
          .order(
            'match_id',
            { ascending: true }
          )

        if (
          matchesError ||
          !existingMatches
        ) {
          continue
        }

        if (
          existingMatches.length !==
          parsedGames.length
        ) {
          continue
        }

        const matchIds =
          existingMatches.map(
            (match) =>
              match.match_id
          )

        const {
          data: existingStats,
          error: statsError,
        } = await supabase
          .from('match_player_stats')
          .select(`
            stat_id,
            match_id,
            player_id,
            goals,
            assists,
            saves,
            shots,
            score
          `)
          .in(
            'match_id',
            matchIds
          )

        if (
          statsError ||
          !existingStats
        ) {
          continue
        }

        const availableMatches =
          [...existingMatches] as ExistingMatch[]

        const mappings:
          MatchMapping[] = []

        let failed = false

        for (
          const game of parsedGames
        ) {
          const matchingIndexes =
            availableMatches
              .map(
                (
                  existingMatch,
                  index
                ) =>
                  gameMatchesExistingMatch(
                    game,
                    existingMatch,
                    existingStats as ExistingPlayerStat[],
                    parsedStats
                  )
                    ? index
                    : -1
              )
              .filter(
                (index) =>
                  index >= 0
              )

          if (
            matchingIndexes.length === 0
          ) {
            failed = true
            break
          }

          /*
           * Normally this should be exactly one match.
           *
           * If two games have identical scores AND
           * identical player box scores, use database
           * order as the deterministic fallback.
           */
          const index =
            matchingIndexes[0]

          const matched =
            availableMatches[index]

          mappings.push({
            replayId:
              game.replayId,

            matchId:
              matched.match_id,
          })

          availableMatches.splice(
            index,
            1
          )
        }

        if (
          !failed &&
          mappings.length ===
            parsedGames.length
        ) {
          compatible.push({
            seriesId:
              candidate.series_id,

            mappings,
          })
        }
      }

      if (
        compatible.length === 1
      ) {
        const match =
          compatible[0]

        setExistingSeriesId(
          match.seriesId
        )

        setBackfillMappings(
          match.mappings
        )

        setImportMode(
          'backfill'
        )

        setExistingSeriesMessage(
          `Existing series found and verified. All ${parsedGames.length} CSV game(s) match the existing Supabase games. Safe backfill mode is available.`
        )

        return
      }

      if (
        compatible.length > 1
      ) {
        setImportMode(
          'conflict'
        )

        setExistingSeriesMessage(
          'More than one compatible existing series was found. Backfill has been blocked for safety.'
        )

        setExistingSeriesId(null)
        setBackfillMappings([])

        return
      }

      setImportMode(
        'conflict'
      )

      setExistingSeriesMessage(
        'A series with this opponent/date exists, but the game scores or player box scores do not match the CSV exactly. Backfill has been blocked to prevent attaching stats to the wrong games.'
      )

      setExistingSeriesId(null)
      setBackfillMappings([])
    } catch (error: any) {
      setImportMode(
        'conflict'
      )

      setExistingSeriesMessage(
        `Could not safely check the existing series: ${error.message}`
      )

      setExistingSeriesId(null)
      setBackfillMappings([])
    }
  }

  useEffect(() => {
    if (
      games.length > 0 &&
      playerStats.length > 0 &&
      importOpponent &&
      importDate
    ) {
      analyzeExistingSeries()
    }
  }, [
    games,
    playerStats,
    importOpponent,
    importDate,
    importCompetitionId,
    importTeam,
  ])

  // ---------------------------------------------------------------------------
  // CSV parse
  // ---------------------------------------------------------------------------

  function handlePlayersFile(
    file: File
  ) {
    clearImportPreview()

    if (
      !importCompetitionId
    ) {
      setImportMessage(
        'Select a competition before uploading a CSV.'
      )
      return
    }

    if (
      rosterPlayers.length === 0
    ) {
      setImportMessage(
        'No roster players were found for this team and format.'
      )
      return
    }

    setImportMessage(
      'Reading CSV...'
    )

    Papa.parse(file, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,

      complete: (
        results: any
      ) => {
        const fields:
          string[] =
          results.meta
            ?.fields ?? []

        if (
          !fields.includes(
            'replay id'
          ) ||
          !fields.includes(
            'player name'
          )
        ) {
          setImportMessage(
            'This does not appear to be a Ballchasing players-games CSV. Please upload the "...-players-games.csv" export.'
          )
          return
        }

        const rows =
          (
            results.data as Record<
              string,
              any
            >[]
          ).filter(
            (row) =>
              textFrom(
                row,
                'replay id'
              ) &&
              textFrom(
                row,
                'player name'
              )
          )

        if (
          rows.length === 0
        ) {
          setImportMessage(
            'No valid player-game rows were found.'
          )
          return
        }

        const byReplay: Record<
          string,
          Record<
            string,
            any
          >[]
        > = {}

        rows.forEach(
          (row) => {
            const replayId =
              textFrom(
                row,
                'replay id'
              )

            if (
              !byReplay[
                replayId
              ]
            ) {
              byReplay[
                replayId
              ] = []
            }

            byReplay[
              replayId
            ].push(row)
          }
        )

        const parsedGames:
          Game[] = []

        const parsedStats:
          PlayerStat[] = []

        const unmatched =
          new Set<string>()

        let detectedOpponent =
          ''

        Object.entries(
          byReplay
        ).forEach(
          ([
            replayId,
            playersInGame,
          ]) => {
            let ourGoals = 0
            let theirGoals = 0

            playersInGame.forEach(
              (row) => {
                const rawName =
                  textFrom(
                    row,
                    'player name'
                  )

                const player =
                  findMatchingPlayer(
                    rawName,
                    rosterPlayers
                  )

                const goals =
                  numberFrom(
                    row,
                    'goals'
                  )

                if (player) {
                  ourGoals += goals

                  const timeOnGround =
                    nullableNumberFrom(
                      row,
                      'time on ground'
                    )

                  const timeLowAir =
                    nullableNumberFrom(
                      row,
                      'time low in air'
                    )

                  const timeHighAir =
                    nullableNumberFrom(
                      row,
                      'time high in air'
                    )

                  const zeroBoostTime =
                    nullableNumberFrom(
                      row,
                      '0 boost time'
                    )

                  const trackedTime =
                    timeOnGround !== null && timeLowAir !== null && timeHighAir !== null
                      ? timeOnGround + timeLowAir + timeHighAir
                      : null

                  const zeroBoostPct =
                    trackedTime !== null && trackedTime > 0 && zeroBoostTime !== null
                      ? (
                          zeroBoostTime /
                          trackedTime
                        ) * 100
                      : null

                  parsedStats.push({
                    replayId,

                    playerId:
                      player.player_id,

                    playerName:
                      player.name,

                    goals,

                    assists:
                      numberFrom(
                        row,
                        'assists'
                      ),

                    saves:
                      numberFrom(
                        row,
                        'saves'
                      ),

                    shots:
                      numberFrom(
                        row,
                        'shots'
                      ),

                    score:
                      numberFrom(
                        row,
                        'score'
                      ),

                    bpm:
                      nullableNumberFrom(
                        row,
                        'bpm'
                      ),

                    avgSpeed:
                      nullableNumberFrom(
                        row,
                        'avg speed'
                      ),

                    timeSupersonic:
                      nullableNumberFrom(
                        row,
                        'time supersonic speed'
                      ),

                    timeOnGround,

                    timeLowAir,

                    timeHighAir,

                    timeDefensiveThird:
                      nullableNumberFrom(
                        row,
                        'time defensive third'
                      ),

                    timeNeutralThird:
                      nullableNumberFrom(
                        row,
                        'time neutral third'
                      ),

                    timeOffensiveThird:
                      nullableNumberFrom(
                        row,
                        'time offensive third'
                      ),

                    percentageSupersonicSpeed:
                      nullableNumberFrom(
                        row,
                        'percentage supersonic speed'
                      ),

                    percentageOnGround:
                      nullableNumberFrom(
                        row,
                        'percentage on ground'
                      ),

                    percentageLowAir:
                      nullableNumberFrom(
                        row,
                        'percentage low in air'
                      ),

                    percentageHighAir:
                      nullableNumberFrom(
                        row,
                        'percentage high in air'
                      ),

                    percentageDefensiveThird:
                      nullableNumberFrom(
                        row,
                        'percentage defensive third'
                      ),

                    percentageNeutralThird:
                      nullableNumberFrom(
                        row,
                        'percentage neutral third'
                      ),

                    percentageOffensiveThird:
                      nullableNumberFrom(
                        row,
                        'percentage offensive third'
                      ),

                    percentageMostBack:
                      nullableNumberFrom(
                        row,
                        'percentage most back'
                      ),

                    percentageMostForward:
                      nullableNumberFrom(
                        row,
                        'percentage most forward'
                      ),

                    percentageBehindBall:
                      nullableNumberFrom(
                        row,
                        'percentage behind ball'
                      ),

                    percentageInFrontOfBall:
                      nullableNumberFrom(
                        row,
                        'percentage in front of ball',
                        'percentage in front of ball.1',
                        'percentage in front of ball_1'
                      ),

                    percentageDefensiveHalf:
                      nullableNumberFrom(
                        row,
                        'percentage defensive half'
                      ),

                    percentageOffensiveHalf:
                      nullableNumberFrom(
                        row,
                        'percentage offensive half'
                      ),

                    avgDistanceToBall:
                      nullableNumberFrom(
                        row,
                        'avg distance to ball'
                      ),

                    avgDistanceToBallHasPossession:
                      nullableNumberFrom(
                        row,
                        'avg distance to ball has possession'
                      ),

                    avgDistanceToBallNoPossession:
                      nullableNumberFrom(
                        row,
                        'avg distance to ball no possession'
                      ),

                    avgDistanceToTeammates:
                      nullableNumberFrom(
                        row,
                        'avg distance to team mates',
                        'avg distance to teammates'
                      ),

                    demosInflicted:
                      nullableNumberFrom(
                        row,
                        'demos inflicted'
                      ),

                    demosTaken:
                      nullableNumberFrom(
                        row,
                        'demos taken'
                      ),

                    boostCollected:
                      nullableNumberFrom(
                        row,
                        'amount collected'
                      ),

                    boostStolen:
                      nullableNumberFrom(
                        row,
                        'amount stolen'
                      ),

                    zeroBoostTime,

                    zeroBoostPct,
                  })
                } else {
                  theirGoals +=
                    goals

                  unmatched.add(
                    rawName
                  )

                  if (
                    !detectedOpponent
                  ) {
                    detectedOpponent =
                      textFrom(
                        row,
                        'team name'
                      ) ||
                      rawName
                  }
                }
              }
            )

            const rawDate =
              textFrom(
                playersInGame[0],
                'date'
              )

            parsedGames.push({
              replayId,

              date:
                rawDate
                  ? rawDate.split(
                      ' '
                    )[0]
                  : '',

              ourGoals,
              theirGoals,
            })
          }
        )

        setGames(
          parsedGames
        )

        setPlayerStats(
          parsedStats
        )

        setUnmatchedPlayers(
          Array.from(
            unmatched
          )
        )

        if (
          detectedOpponent
        ) {
          setImportOpponent(
            detectedOpponent
          )
        }

        if (
          parsedGames[0]
            ?.date
        ) {
          setImportDate(
            parsedGames[0]
              .date
          )
        }

        setImportMessage(
          `Parsed ${parsedGames.length} game(s) and matched ${parsedStats.length} Flop Reset player-game rows.`
        )
      },

      error: (error) => {
        setImportMessage(
          `CSV parse error: ${error.message}`
        )
      },
    })
  }

  // ---------------------------------------------------------------------------
  // NEW SERIES import
  // ---------------------------------------------------------------------------

  async function handleNewImport() {
    if (
      importMode !==
      'new'
    ) {
      setImportMessage(
        'This CSV is not currently cleared for a new-series import.'
      )
      return
    }

    if (
      !games.length ||
      !playerStats.length
    ) {
      setImportMessage(
        'Nothing is ready to import.'
      )
      return
    }

    const intendedBestOf = Number(importBestOf)
    if (!Number.isInteger(intendedBestOf) || intendedBestOf < games.length || intendedBestOf < 1 || intendedBestOf % 2 === 0) {
      setImportMessage('Enter the intended odd best-of value (for example 3, 5, or 7); it cannot be smaller than the games in this CSV.')
      return
    }

    setImportMessage(
      'Saving new series...'
    )

    try {
      const {
        competition,
        team,
      } = await getImportContext()

      const replayIds =
        games.map(
          (game) =>
            game.replayId
        )

      const {
        data: duplicateReplays,
        error: replayError,
      } = await supabase
        .from('matches')
        .select(
          'match_id, replay_id'
        )
        .in(
          'replay_id',
          replayIds
        )

      if (replayError) {
        throw replayError
      }

      if (
        duplicateReplays &&
        duplicateReplays.length >
          0
      ) {
        throw new Error(
          'One or more replay IDs are already stored in Supabase. Import blocked to prevent duplicate games.'
        )
      }

      const {
        data: series,
        error: seriesError,
      } = await supabase
        .from('series')
        .insert({
          competition_id:
            competition.id,

          flop_reset_team_id:
            team.id,

          opponent_name:
            importOpponent,

          best_of:
            intendedBestOf,

          series_date:
            importDate,

          notes:
            `Imported via Ballchasing players-games CSV — ${importOpponent}`,
        })
        .select()
        .single()

      if (
        seriesError ||
        !series
      ) {
        throw new Error(
          seriesError
            ?.message ??
          'Could not create series.'
        )
      }

      try {
        for (
          const game of games
        ) {
          const {
            data: match,
            error: matchError,
          } = await supabase
            .from('matches')
            .insert({
              competition_id:
                competition.id,

              flop_reset_team_id:
                team.id,

              series_id:
                series.series_id,

              opponent_name:
                importOpponent,

              flop_reset_score:
                game.ourGoals,

              opponent_score:
                game.theirGoals,

              match_date:
                game.date ||
                importDate,

              replay_id:
                game.replayId,
            })
            .select()
            .single()

          if (
            matchError ||
            !match
          ) {
            throw new Error(
              matchError
                ?.message ??
              `Could not create game ${game.replayId}.`
            )
          }

          const statsForGame =
            playerStats.filter(
              (stat) =>
                stat.replayId ===
                game.replayId
            )

          const rowsToInsert =
            statsForGame.map(
              (stat) => ({
                match_id:
                  match.match_id,

                player_id:
                  stat.playerId,

                goals:
                  stat.goals,

                assists:
                  stat.assists,

                saves:
                  stat.saves,

                shots:
                  stat.shots,

                score:
                  stat.score,

                ...processSkillUpdate(
                  stat
                ),
              })
            )

          if (
            rowsToInsert.length
          ) {
            const {
              error: statsError,
            } = await supabase
              .from(
                'match_player_stats'
              )
              .insert(
                rowsToInsert
              )

            if (
              statsError
            ) {
              throw new Error(
                statsError.message
              )
            }
          }
        }

        setImportMessage(
          `Successfully imported ${games.length} new game(s) and ${playerStats.length} player-stat rows.`
        )

        clearImportPreview()
        loadManageData()
      } catch (error) {
        const {
          data: createdMatches,
        } = await supabase
          .from('matches')
          .select('match_id')
          .eq(
            'series_id',
            series.series_id
          )

        const ids =
          createdMatches?.map(
            (match) =>
              match.match_id
          ) ?? []

        if (ids.length) {
          await supabase
            .from(
              'match_player_stats'
            )
            .delete()
            .in(
              'match_id',
              ids
            )

          await supabase
            .from('matches')
            .delete()
            .eq(
              'series_id',
              series.series_id
            )
        }

        await supabase
          .from('series')
          .delete()
          .eq(
            'series_id',
            series.series_id
          )

        throw error
      }
    } catch (error: any) {
      setImportMessage(
        `Import failed: ${error.message}`
      )
    }
  }

  // ---------------------------------------------------------------------------
  // EXISTING SERIES backfill
  // ---------------------------------------------------------------------------

  async function handleBackfillExistingSeries() {
    if (
      importMode !==
        'backfill' ||
      !existingSeriesId ||
      backfillMappings.length !==
        games.length
    ) {
      setImportMessage(
        'Backfill is not currently verified.'
      )
      return
    }

    const confirmed =
      confirm(
        'Backfill this existing series? This will NOT create new games or duplicate box-score stats. It will attach replay IDs and update detailed Process Skills data on the existing player rows.'
      )

    if (!confirmed) {
      return
    }

    setImportMessage(
      'Validating existing series before backfill...'
    )

    try {
      /*
       * First make sure none of these replay IDs
       * are attached to DIFFERENT matches.
       */
      const replayIds =
        games.map(
          (game) =>
            game.replayId
        )

      const {
        data: existingReplayRows,
        error: replayError,
      } = await supabase
        .from('matches')
        .select(
          'match_id, replay_id'
        )
        .in(
          'replay_id',
          replayIds
        )

      if (replayError) {
        throw replayError
      }

      for (
        const existing of
          existingReplayRows ??
          []
      ) {
        const allowed =
          backfillMappings.some(
            (mapping) =>
              mapping.matchId ===
                existing.match_id &&
              mapping.replayId ===
                existing.replay_id
          )

        if (!allowed) {
          throw new Error(
            `Replay ID ${existing.replay_id} is already attached to another match. Backfill stopped.`
          )
        }
      }

      /*
       * Pre-validate every existing player row.
       *
       * Nothing is written until we know every
       * player/game row is present.
       */
      const matchIds =
        backfillMappings.map(
          (mapping) =>
            mapping.matchId
        )

      const {
        data: existingStats,
        error: existingStatsError,
      } = await supabase
        .from(
          'match_player_stats'
        )
        .select(`
          stat_id,
          match_id,
          player_id,
          goals,
          assists,
          saves,
          shots,
          score
        `)
        .in(
          'match_id',
          matchIds
        )

      if (
        existingStatsError ||
        !existingStats
      ) {
        throw new Error(
          existingStatsError
            ?.message ??
          'Could not load existing player rows.'
        )
      }

      const work: {
        statId: number
        stat: PlayerStat
        matchId: number
        replayId: string
      }[] = []

      for (
        const mapping of
          backfillMappings
      ) {
        const csvStats =
          playerStats.filter(
            (stat) =>
              stat.replayId ===
              mapping.replayId
          )

        for (
          const csvStat of
            csvStats
        ) {
          const existingStat =
            (
              existingStats as ExistingPlayerStat[]
            ).find(
              (row) =>
                Number(
                  row.match_id
                ) ===
                  Number(
                    mapping.matchId
                  ) &&
                Number(
                  row.player_id
                ) ===
                  Number(
                    csvStat.playerId
                  )
            )

          if (!existingStat) {
            throw new Error(
              `Existing player row was not found for ${csvStat.playerName} in replay ${mapping.replayId}. No changes were made.`
            )
          }

          if (
            !statRowsMatch(
              existingStat,
              csvStat
            )
          ) {
            throw new Error(
              `Existing box-score data for ${csvStat.playerName} does not match the CSV. No changes were made.`
            )
          }

          work.push({
            statId:
              existingStat.stat_id,

            stat:
              csvStat,

            matchId:
              mapping.matchId,

            replayId:
              mapping.replayId,
          })
        }
      }

      setImportMessage(
        `Verified ${backfillMappings.length} games and ${work.length} existing player rows. Backfilling Process Skills...`
      )

      /*
       * Attach replay IDs first.
       */
      for (
        const mapping of
          backfillMappings
      ) {
        const {
          error,
        } = await supabase
          .from('matches')
          .update({
            replay_id:
              mapping.replayId,
          })
          .eq(
            'match_id',
            mapping.matchId
          )

        if (error) {
          throw new Error(
            `Could not save replay ID ${mapping.replayId}: ${error.message}`
          )
        }
      }

      /*
       * Update ONLY Process Skills / tracking fields.
       *
       * Goals, assists, saves, shots, score, match
       * result, series, etc. are untouched.
       */
      for (
        const item of work
      ) {
        const {
          error,
        } = await supabase
          .from(
            'match_player_stats'
          )
          .update(
            processSkillUpdate(
              item.stat
            )
          )
          .eq(
            'stat_id',
            item.statId
          )

        if (error) {
          throw new Error(
            `Could not backfill ${item.stat.playerName}: ${error.message}`
          )
        }
      }

      setImportMessage(
        `Backfill successful! Updated ${backfillMappings.length} existing game(s) and ${work.length} existing player rows. No games or box-score stats were duplicated.`
      )

      setExistingSeriesMessage(
        'Backfill complete. Replay IDs and detailed Process Skills are now attached to this existing series.'
      )

      await analyzeExistingSeries()
      loadManageData()
    } catch (error: any) {
      setImportMessage(
        `Backfill stopped: ${error.message}`
      )
    }
  }

  // ---------------------------------------------------------------------------
  // Manual result
  // ---------------------------------------------------------------------------

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault()

    setMessage('Saving...')

    try {
      const { competition, team } = await resolveCompetitionTeam(competitionId, teamName)

      /*
       * Forfeit result is still represented by 1-0 / 0-1
       * until the dedicated forfeit-result migration is done.
       */
      const finalFlopScore =
        isForfeit
          ? forfeitResult ===
            'win'
            ? 1
            : 0
          : Number(
              flopScore
            )

      const finalOpponentScore =
        isForfeit
          ? forfeitResult ===
            'win'
            ? 0
            : 1
          : Number(
              opponentScore
            )

      const {
        data: series,
        error: seriesError,
      } = await supabase
        .from('series')
        .insert({
          competition_id:
            competition.id,

          flop_reset_team_id:
            team.id,

          opponent_name:
            opponentName,

          best_of: 1,

          series_date:
            matchDate,

          notes:
            isForfeit
              ? `${
                  forfeitResult ===
                  'win'
                    ? 'Forfeit Win'
                    : 'Forfeit Loss'
                }${
                  matchRound
                    ? ` — ${matchRound}`
                    : ''
                }`
              : matchRound ||
                null,
        })
        .select()
        .single()

      if (
        seriesError ||
        !series
      ) {
        throw new Error(
          seriesError
            ?.message ??
          'Could not create series.'
        )
      }

      const {
        error: matchError,
      } = await supabase
        .from('matches')
        .insert({
          competition_id:
            competition.id,

          flop_reset_team_id:
            team.id,

          series_id:
            series.series_id,

          opponent_name:
            opponentName,

          flop_reset_score:
            finalFlopScore,

          opponent_score:
            finalOpponentScore,

          is_forfeit:
            isForfeit,

          match_date:
            matchDate,

          round:
            matchRound ||
            null,
        })

      if (matchError) {
        throw matchError
      }

      setMessage(
        'Match saved!'
      )

      setOpponentName('')
      setFlopScore('')
      setOpponentScore('')
      setMatchDate('')
      setIsForfeit(false)
      setForfeitResult('win')
      setMatchRound('')

      loadManageData()
    } catch (error: any) {
      setMessage(
        `Error: ${error.message}`
      )
    }
  }

  // ---------------------------------------------------------------------------
  // Schedule
  // ---------------------------------------------------------------------------

  async function handleScheduleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault()

    setScheduleMessage(
      'Saving...'
    )

    try {
      const { team } = await resolveCompetitionTeam(scheduleCompetitionId, scheduleTeamName)
      const { error } = await supabase.from('scheduled_matches').insert({
        competition_id:
          scheduleCompetitionId,

        flop_reset_team_id:
          team.id,

        opponent_name:
          scheduleOpponent ||
          null,

        match_date:
          scheduleDate,

        match_time:
          scheduleTime,

        notes:
          scheduleNotes,

        status:
          'scheduled',
      })

      if (error) throw error

    setScheduleMessage(
      'Scheduled match added!'
    )

    setScheduleOpponent('')
    setScheduleDate('')
    setScheduleTime('')
    setScheduleNotes('')

      loadScheduled()
    } catch (error: any) {
      setScheduleMessage(`Error: ${error.message}`)
    }
  }

  async function deleteScheduled(
    id: number
  ) {
    if (
      !confirm(
        'Delete this scheduled match?'
      )
    ) {
      return
    }

    await supabase
      .from(
        'scheduled_matches'
      )
      .delete()
      .eq(
        'scheduled_id',
        id
      )

    loadScheduled()
  }

  async function markCompleted(
    id: number
  ) {
    await supabase
      .from(
        'scheduled_matches'
      )
      .update({
        status:
          'completed',
      })
      .eq(
        'scheduled_id',
        id
      )

    loadScheduled()
  }

  // ---------------------------------------------------------------------------
  // Power Rankings
  // ---------------------------------------------------------------------------

  function handlePrParse() {
    try {
      const parsed =
        parseLeagueMatches(
          prText
        )

      setPrPreview(parsed)

      setPrMessage(
        `Parsed ${parsed.length} matches.`
      )
    } catch (
      error: any
    ) {
      setPrMessage(
        `Parse error: ${error.message}`
      )
    }
  }

  async function handlePrConfirm() {
    if (
      !prPreview.length
    ) {
      setPrMessage(
        'Nothing to import.'
      )
      return
    }

    setPrMessage(
      'Saving...'
    )

    const label =
      new Date()
        .toISOString()
        .split('T')[0]

    const rows =
      prPreview.map(
        (match) => ({
          ...match,
          format:
            prFormat,
          batch_label:
            label,
        })
      )

    const {
      count,
    } = await supabase
      .from('league_matches')
      .select(
        '*',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'format',
        prFormat
      )
      .eq(
        'batch_label',
        label
      )

    if (
      count &&
      count > 0
    ) {
      if (
        !confirm(
          `A ${prFormat} batch already exists for ${label}. Import again?`
        )
      ) {
        setPrMessage(
          'Import cancelled.'
        )
        return
      }
    }

    const {
      error,
    } = await supabase
      .from(
        'league_matches'
      )
      .insert(rows)

    if (error) {
      setPrMessage(
        `Error: ${error.message}`
      )
      return
    }

    setPrMessage(
      `Imported ${rows.length} matches!`
    )

    setPrPreview([])
    setPrText('')

    loadManageData()
  }

  // ---------------------------------------------------------------------------
  // Manage
  // ---------------------------------------------------------------------------

  async function deleteSeries(
    seriesId: number
  ) {
    if (
      !confirm(
        'Delete this series and all its games/stats? This cannot be undone.'
      )
    ) {
      return
    }

    const {
      data: matchRows,
      error: fetchError,
    } = await supabase
      .from('matches')
      .select('match_id')
      .eq(
        'series_id',
        seriesId
      )

    if (fetchError) {
      alert(
        fetchError.message
      )
      return
    }

    const matchIds =
      matchRows?.map(
        (match) =>
          match.match_id
      ) ?? []

    if (matchIds.length) {
      const {
        error,
      } = await supabase
        .from(
          'match_player_stats'
        )
        .delete()
        .in(
          'match_id',
          matchIds
        )

      if (error) {
        alert(
          error.message
        )
        return
      }
    }

    const {
      error: matchError,
    } = await supabase
      .from('matches')
      .delete()
      .eq(
        'series_id',
        seriesId
      )

    if (matchError) {
      alert(
        matchError.message
      )
      return
    }

    const {
      error: seriesError,
    } = await supabase
      .from('series')
      .delete()
      .eq(
        'series_id',
        seriesId
      )

    if (seriesError) {
      alert(
        seriesError.message
      )
      return
    }

    loadManageData()
  }

  async function deleteBatch(
    batchLabel: string,
    format: string
  ) {
    if (
      !confirm(
        `Delete all ${format} matches from batch "${batchLabel}"?`
      )
    ) {
      return
    }

    const query =
      supabase
        .from(
          'league_matches'
        )
        .delete()
        .eq(
          'format',
          format
        )

    const { error } =
      batchLabel
        ? await query.eq(
            'batch_label',
            batchLabel
          )
        : await query.is(
            'batch_label',
            null
          )

    if (error) {
      alert(
        error.message
      )
      return
    }

    loadManageData()
  }

  const tabClass = (
    target: string
  ) =>
    `px-4 py-2 rounded-t-lg font-semibold ${
      tab === target
        ? 'bg-neutral-900 text-white'
        : 'bg-neutral-950 text-neutral-500 hover:text-neutral-300'
    }`

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  return (
    <main className="px-4 md:px-8 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        Admin
      </h1>

      <div className="flex gap-1 border-b border-neutral-800 mb-8 flex-wrap">
        <button
          onClick={() =>
            setTab('add')
          }
          className={
            tabClass('add')
          }
        >
          Add Result
        </button>

        <button
          onClick={() =>
            setTab('import')
          }
          className={
            tabClass('import')
          }
        >
          Import CSV
        </button>

        <button
          onClick={() =>
            setTab('schedule')
          }
          className={
            tabClass('schedule')
          }
        >
          Schedule
        </button>

        <button
          onClick={() =>
            setTab('rankings')
          }
          className={
            tabClass('rankings')
          }
        >
          Power Rankings
        </button>

        <button
          onClick={() =>
            setTab('manage')
          }
          className={
            tabClass('manage')
          }
        >
          Manage
        </button>
      </div>

      {/* ADD RESULT */}

      {tab === 'add' && (
        <form
          onSubmit={
            handleSubmit
          }
          className="flex flex-col gap-4"
        >
          <label>
            Competition:
            <select
              value={
                competitionId
              }
              onChange={(e) =>
                setCompetitionId(
                  e.target.value
                )
              }
              className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
            >
              {competitions.map(
                (competition) => (
                  <option
                    key={
                      competition.id
                    }
                    value={
                      competition.id
                    }
                  >
                    {formatCompetitionAdminLabel(competition)}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Team:
            <select
              value={teamName}
              onChange={(e) =>
                setTeamName(
                  e.target.value
                )
              }
              className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
            >
              <option value="Frameshift">
                Frameshift
              </option>
              <option value="Frantic">
                Frantic
              </option>
              <option value="Fracture">
                Fracture
              </option>
            </select>
          </label>

          <label>
            Opponent:
            <input
              value={
                opponentName
              }
              onChange={(e) =>
                setOpponentName(
                  e.target.value
                )
              }
              required
              className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={
                isForfeit
              }
              onChange={(e) =>
                setIsForfeit(
                  e.target.checked
                )
              }
            />{' '}
            This was a forfeit
          </label>

          {isForfeit ? (
            <label>
              Result:
              <select
                value={
                  forfeitResult
                }
                onChange={(e) =>
                  setForfeitResult(
                    e.target.value as
                      | 'win'
                      | 'loss'
                  )
                }
                className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
              >
                <option value="win">
                  Win (opponent forfeited)
                </option>
                <option value="loss">
                  Loss (we forfeited)
                </option>
              </select>
            </label>
          ) : (
            <>
              <label>
                Your Score:
                <input
                  type="number"
                  min="0"
                  value={
                    flopScore
                  }
                  onChange={(e) =>
                    setFlopScore(
                      e.target.value
                    )
                  }
                  required
                  className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
                />
              </label>

              <label>
                Opponent Score:
                <input
                  type="number"
                  min="0"
                  value={
                    opponentScore
                  }
                  onChange={(e) =>
                    setOpponentScore(
                      e.target.value
                    )
                  }
                  required
                  className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
                />
              </label>
            </>
          )}

          <label>
            Date:
            <input
              type="date"
              value={
                matchDate
              }
              onChange={(e) =>
                setMatchDate(
                  e.target.value
                )
              }
              required
              className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
            />
          </label>

          <label>
            Round:
            <input
              value={
                matchRound
              }
              onChange={(e) =>
                setMatchRound(
                  e.target.value
                )
              }
              className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
            />
          </label>

          <button
            type="submit"
            className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded w-fit"
          >
            Save Match
          </button>

          {message && (
            <p>{message}</p>
          )}
        </form>
      )}

      {/* CSV IMPORT */}

      {tab === 'import' && (
        <div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 mb-6">
            <h2 className="font-semibold mb-1">
              Ballchasing Import
            </h2>

            <p className="text-sm text-neutral-500">
              Upload the detailed{' '}
              <strong>
                players-games.csv
              </strong>{' '}
              export. Existing series are automatically detected and can be safely backfilled.
            </p>
          </div>

          <label className="block mb-4">
            Competition:
            <select
              value={
                importCompetitionId
              }
              onChange={(e) => {
                setImportCompetitionId(
                  e.target.value
                )
                clearImportPreview()
              }}
              className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
            >
              {competitions.map(
                (competition) => (
                  <option
                    key={
                      competition.id
                    }
                    value={
                      competition.id
                    }
                  >
                    {formatCompetitionAdminLabel(competition)}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="block mb-4">
            Team:
            <select
              value={
                importTeam
              }
              onChange={(e) => {
                setImportTeam(
                  e.target.value
                )
                clearImportPreview()
              }}
              className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
            >
              <option value="Frameshift">
                Frameshift
              </option>
              <option value="Frantic">
                Frantic
              </option>
              <option value="Fracture">
                Fracture
              </option>
            </select>
          </label>

          <div className="text-xs text-neutral-500 mb-4">
            Roster loaded:{' '}
            {
              rosterPlayers.length
            }{' '}
            player
            {rosterPlayers.length ===
            1
              ? ''
              : 's'}
          </div>

          <label className="block mb-6">
            Players-Games CSV:
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file =
                  e.target.files?.[0]

                if (file) {
                  handlePlayersFile(
                    file
                  )
                }
              }}
              className="block mt-2"
            />
          </label>

          {importMessage && (
            <p className="text-neutral-300 mb-4">
              {
                importMessage
              }
            </p>
          )}

          {unmatchedPlayers.length >
            0 && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4 mb-5">
              <div className="font-semibold text-sm mb-2">
                Opponent players detected
              </div>

              <div className="text-xs text-neutral-400">
                {unmatchedPlayers.join(
                  ', '
                )}
              </div>
            </div>
          )}

          {games.length > 0 && (
            <div>
              <label className="block mb-4">
                Opponent:
                <input
                  value={
                    importOpponent
                  }
                  onChange={(e) =>
                    setImportOpponent(
                      e.target.value
                    )
                  }
                  className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
                />
              </label>

              <label className="block mb-5">
                Series Date:
                <input
                  type="date"
                  value={
                    importDate
                  }
                  onChange={(e) =>
                    setImportDate(
                      e.target.value
                    )
                  }
                  className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
                />
              </label>

              <label className="block mb-5">
                Intended Best Of:
                <input
                  type="number"
                  min={games.length}
                  step="2"
                  value={importBestOf}
                  onChange={(e) => setImportBestOf(e.target.value)}
                  placeholder="3, 5, or 7"
                  className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
                />
                <span className="mt-1 block text-xs text-neutral-500">Use the scheduled series length, not only the number of games played.</span>
              </label>

              {/* IMPORT MODE */}

              <div
                className={`rounded-xl border p-4 mb-6 ${
                  importMode ===
                  'backfill'
                    ? 'border-green-800 bg-green-950/20'
                    : importMode ===
                      'conflict'
                    ? 'border-red-800 bg-red-950/20'
                    : importMode ===
                      'checking'
                    ? 'border-yellow-800 bg-yellow-950/20'
                    : 'border-neutral-800 bg-neutral-950/50'
                }`}
              >
                <div className="font-semibold mb-1">
                  {importMode ===
                  'backfill'
                    ? '✓ Existing Series Found'
                    : importMode ===
                      'conflict'
                    ? '⚠ Import Conflict'
                    : importMode ===
                      'checking'
                    ? 'Checking Existing Data...'
                    : 'New Series Import'}
                </div>

                <p className="text-sm text-neutral-400">
                  {
                    existingSeriesMessage
                  }
                </p>

                {importMode ===
                  'backfill' &&
                  existingSeriesId && (
                  <p className="text-xs text-neutral-500 mt-2">
                    Existing Series ID:{' '}
                    {
                      existingSeriesId
                    } · Verified games:{' '}
                    {
                      backfillMappings.length
                    }
                  </p>
                )}
              </div>

              <h2 className="text-xl font-semibold mb-2">
                Games ({games.length})
              </h2>

              <div className="space-y-1 mb-6">
                {games.map(
                  (game) => (
                    <div
                      key={
                        game.replayId
                      }
                      className="text-sm text-neutral-300"
                    >
                      {game.date} —{' '}
                      {
                        game.ourGoals
                      }
                      -
                      {
                        game.theirGoals
                      }

                      <span className="text-neutral-600 ml-2 text-xs">
                        {
                          game.replayId
                        }
                      </span>
                    </div>
                  )
                )}
              </div>

              <h2 className="text-xl font-semibold mb-2">
                Player Stats (
                {
                  playerStats.length
                } rows)
              </h2>

              <div className="max-h-64 overflow-y-auto rounded-lg border border-neutral-800 mb-4">
                {playerStats.map(
                  (
                    player,
                    index
                  ) => (
                    <div
                      key={`${player.replayId}-${player.playerId}-${index}`}
                      className="text-sm text-neutral-400 px-3 py-2 border-b border-neutral-900 last:border-0"
                    >
                      <span className="text-white font-medium">
                        {
                          player.playerName
                        }
                      </span>
                      :{' '}
                      {
                        player.goals
                      }
                      G{' '}
                      {
                        player.assists
                      }
                      A{' '}
                      {
                        player.saves
                      }
                      SV · BPM{' '}
                      {player.bpm === null ? '—' : Math.round(player.bpm)}{' '}
                      · Speed{' '}
                      {player.avgSpeed === null ? '—' : Math.round(player.avgSpeed)}{' '}
                      · Zero Boost{' '}
                      {player.zeroBoostPct === null ? '—' : `${player.zeroBoostPct.toFixed(1)}%`}
                    </div>
                  )
                )}
              </div>

              {importMode ===
                'new' && (
                <button
                  onClick={
                    handleNewImport
                  }
                  className="mt-2 bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded"
                >
                  Confirm New Import
                </button>
              )}

              {importMode ===
                'backfill' && (
                <button
                  onClick={
                    handleBackfillExistingSeries
                  }
                  className="mt-2 bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded"
                >
                  Backfill Existing Series
                </button>
              )}

              {importMode ===
                'checking' && (
                <button
                  disabled
                  className="mt-2 bg-neutral-800 text-neutral-500 px-4 py-2 rounded cursor-not-allowed"
                >
                  Checking...
                </button>
              )}

              {importMode ===
                'conflict' && (
                <button
                  disabled
                  className="mt-2 bg-red-950 text-red-500 px-4 py-2 rounded cursor-not-allowed"
                >
                  Import Blocked
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* SCHEDULE */}

      {tab === 'schedule' && (
        <div>
          <form
            onSubmit={
              handleScheduleSubmit
            }
            className="flex flex-col gap-4"
          >
            <label>
              Competition:
              <select
                value={
                  scheduleCompetitionId
                }
                onChange={(e) =>
                  setScheduleCompetitionId(
                    e.target.value
                  )
                }
                className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
              >
                {competitions.map(
                  (competition) => (
                    <option
                      key={
                        competition.id
                      }
                      value={
                        competition.id
                      }
                    >
                      {formatCompetitionAdminLabel(competition)}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Team:
              <select
                value={
                  scheduleTeamName
                }
                onChange={(e) =>
                  setScheduleTeamName(
                    e.target.value
                  )
                }
                className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
              >
                <option value="Frameshift">
                  Frameshift
                </option>
                <option value="Frantic">
                  Frantic
                </option>
                <option value="Fracture">
                  Fracture
                </option>
              </select>
            </label>

            <label>
              Opponent:
              <input
                value={
                  scheduleOpponent
                }
                onChange={(e) =>
                  setScheduleOpponent(
                    e.target.value
                  )
                }
                className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
              />
            </label>

            <label>
              Date:
              <input
                type="date"
                value={
                  scheduleDate
                }
                onChange={(e) =>
                  setScheduleDate(
                    e.target.value
                  )
                }
                required
                className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
              />
            </label>

            <label>
              Time:
              <input
                value={
                  scheduleTime
                }
                onChange={(e) =>
                  setScheduleTime(
                    e.target.value
                  )
                }
                className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
              />
            </label>

            <label>
              Notes:
              <input
                value={
                  scheduleNotes
                }
                onChange={(e) =>
                  setScheduleNotes(
                    e.target.value
                  )
                }
                className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
              />
            </label>

            <button
              type="submit"
              className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded w-fit"
            >
              Add to Schedule
            </button>

            {scheduleMessage && (
              <p>
                {
                  scheduleMessage
                }
              </p>
            )}
          </form>

          <div className="mt-8 space-y-2">
            <h2 className="text-xl font-semibold">
              Current Schedule
            </h2>

            {scheduledList.map(
              (scheduled) => (
                <div
                  key={
                    scheduled.scheduled_id
                  }
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-neutral-800 rounded p-3"
                >
                  <span>
                    {
                      (
                        scheduled.teams as any
                      )?.name
                    }{' '}
                    vs{' '}
                    {scheduled.opponent_name ??
                      'TBD'}{' '}
                    —{' '}
                    {
                      scheduled.match_date
                    }{' '}
                    {
                      scheduled.match_time
                    }{' '}
                    (
                    {
                      scheduled.status
                    })
                  </span>

                  <span className="flex gap-3">
                    {scheduled.status ===
                      'scheduled' && (
                      <button
                        type="button"
                        onClick={() =>
                          markCompleted(
                            scheduled.scheduled_id
                          )
                        }
                        className="text-sm text-green-400"
                      >
                        Mark Completed
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        deleteScheduled(
                          scheduled.scheduled_id
                        )
                      }
                      className="text-sm text-red-400"
                    >
                      Delete
                    </button>
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* POWER RANKINGS */}

      {tab === 'rankings' && (
        <div>
          <label className="block mb-4">
            Format:
            <select
              value={prFormat}
              onChange={(e) =>
                setPrFormat(
                  e.target.value
                )
              }
              className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2"
            >
              <option value="3v3">
                3v3
              </option>
              <option value="2v2">
                2v2
              </option>
            </select>
          </label>

          <label className="block mb-4">
            Paste the full match list from The Rivalry:
            <textarea
              value={prText}
              onChange={(e) =>
                setPrText(
                  e.target.value
                )
              }
              rows={10}
              className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full font-mono text-xs"
            />
          </label>

          <button
            onClick={
              handlePrParse
            }
            className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded mb-4"
          >
            Parse
          </button>

          {prMessage && (
            <p className="text-neutral-300 mb-4">
              {prMessage}
            </p>
          )}

          {prPreview.length >
            0 && (
            <div>
              <div className="max-h-64 overflow-y-auto text-xs text-neutral-400 space-y-1 mb-4">
                {prPreview
                  .slice(0, 20)
                  .map(
                    (
                      match,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                      >
                        {
                          match.round
                        } /{' '}
                        {
                          match.tier
                        }
                        :{' '}
                        {
                          match.team_a
                        } vs{' '}
                        {match.team_b ??
                          '(bye)'}{' '}
                        —{' '}
                        {
                          match.status
                        }
                      </div>
                    )
                  )}
              </div>

              <button
                onClick={
                  handlePrConfirm
                }
                className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded"
              >
                Confirm Import
              </button>
            </div>
          )}
        </div>
      )}

      {/* MANAGE */}

      {tab === 'manage' && (
        <div>
          <h2 className="text-xl font-bold mb-4">
            Match Results (Series)
          </h2>

          <div className="space-y-2 mb-10">
            {manageSeries.map(
              (series) => (
                <div
                  key={
                    series.series_id
                  }
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-neutral-800 rounded p-3"
                >
                  <span>
                    {
                      (
                        series.teams as any
                      )?.name
                    }{' '}
                    (
                    {
                      (
                        series.teams as any
                      )?.format
                    }) vs{' '}
                    {
                      series.opponent_name
                    }{' '}
                    —{' '}
                    {
                      series.series_date
                    }
                  </span>

                  <button
                    onClick={() =>
                      deleteSeries(
                        series.series_id
                      )
                    }
                    className="text-sm text-red-400"
                  >
                    Delete
                  </button>
                </div>
              )
            )}
          </div>

          <h2 className="text-xl font-bold mb-4 mt-10">
            Assign MVP
          </h2>

          <div className="flex gap-2 mb-4">
            <input
              placeholder="Match ID"
              value={
                mvpMatchId
              }
              onChange={(e) =>
                setMvpMatchId(
                  e.target.value
                )
              }
              className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
            />

            <button
              onClick={() =>
                loadMvpCandidates(
                  mvpMatchId
                )
              }
              className="bg-purple-700 px-4 py-2 rounded text-sm"
            >
              Load Players
            </button>
          </div>

          {mvpCandidates.map(
            (candidate) => (
              <div
                key={
                  candidate.stat_id
                }
                className="flex items-center justify-between border border-neutral-800 rounded p-3 mb-2"
              >
                <span>
                  {
                    candidate.players
                      ?.name
                  }

                  {candidate.mvp && (
                    <span className="text-purple-400 ml-2">
                      ★ Current MVP
                    </span>
                  )}
                </span>

                <button
                  onClick={() =>
                    setMvp(
                      candidate.stat_id,
                      mvpMatchId
                    )
                  }
                  className="text-sm text-purple-400"
                >
                  Set MVP
                </button>
              </div>
            )
          )}

          <h2 className="text-xl font-bold mb-4 mt-10">
            Power Rankings Imports
          </h2>

          <div className="space-y-2">
            {manageBatches.map(
              (batch) => (
                <div
                  key={`${batch.batch_label}-${batch.format}`}
                  className="flex items-center justify-between border border-neutral-800 rounded p-3"
                >
                  <span>
                    {
                      batch.format
                    } —{' '}
                    {
                      batch.batch_label
                    } (
                    {
                      batch.count
                    } matches)
                  </span>

                  <button
                    onClick={() =>
                      deleteBatch(
                        batch.batch_label,
                        batch.format
                      )
                    }
                    className="text-sm text-red-400"
                  >
                    Delete
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </main>
  )
}
