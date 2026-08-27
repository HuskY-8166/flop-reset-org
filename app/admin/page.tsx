/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase'
import { PlayoffAdminEditor } from '@/components/PlayoffAdminEditor'
import { LeagueDirectoryAdmin, LeagueDirectoryHealth } from '@/components/LeagueDirectoryAdmin'
import { parseLeagueMatches } from '@/lib/parseLeagueMatches'
import { formatCompetitionAdminLabel } from '@/lib/competitions'
import { formatPublicDate } from '@/lib/results'
import {
  expectedPlayersForFormat,
  identifyReplaySides,
  normalizeImportIdentity,
  resolveRosterIdentity,
} from '@/lib/importValidation'
import {
  detectBallchasingFile,
  getPlayersCsvCoverage,
  mapPlayersCsvRow,
  nonNullUpdate,
  type PlayerSummaryRow,
  type TrackingCoverage,
} from '@/lib/ballchasingImport'

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

type TeamRegistration = {
  id: number
  name: string
  format: string
}

type Game = {
  replayId: string
  date: string
  ourGoals: number | null
  theirGoals: number | null
  error?: string
}

type PlayerMapping = {
  rawName: string
  canonicalName: string
}

type ImportValidation = {
  errors: string[]
  warnings: string[]
  expectedFrRows: number
  resolvedFrRows: number
  opponentRows: number
  replayIds: number
  coverage: TrackingCoverage
}

type RebuildHealth = {
  loading: boolean
  error: string
  counts: {
    competitions: number
    teams: number
    players: number
    opponents: number
    series: number
    matches: number
    playerStats: number
    leagueMatches: number
    scheduledMatches: number
    playoffBrackets: number
    playoffMatches: number
    forfeits: number
    playedGames: number
    replayIds: number
    duplicateReplayIds: number
    teamsRepresented: number
    advancedRows: number
    orphanPlayerRows: number
    wrongPlayerRowGames: number
    seriesWithoutGames: number
    playedGamesWithoutStats: number
    forfeitGameRows: number
  }
  checks: {
    competitionMismatches: number
    playerAliasesValid: boolean
    opponentAliasesValid: boolean
    structuralTablesValid: boolean
  }
}

const EMPTY_REBUILD_HEALTH: RebuildHealth = {
  loading: true,
  error: '',
  counts: {
    competitions: 0, teams: 0, players: 0, opponents: 0, series: 0,
    matches: 0, playerStats: 0, leagueMatches: 0, scheduledMatches: 0,
    playoffBrackets: 0, playoffMatches: 0, forfeits: 0, playedGames: 0,
    replayIds: 0, duplicateReplayIds: 0, teamsRepresented: 0, advancedRows: 0,
    orphanPlayerRows: 0, wrongPlayerRowGames: 0, seriesWithoutGames: 0,
    playedGamesWithoutStats: 0, forfeitGameRows: 0,
  },
  checks: {
    competitionMismatches: 0,
    playerAliasesValid: false,
    opponentAliasesValid: false,
    structuralTablesValid: false,
  },
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
    'playoffs' |
    'directory' |
    'manage' |
    'rebuild'
  >('add')

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab')
    if (requested === 'add' || requested === 'import' || requested === 'schedule' || requested === 'rankings' || requested === 'playoffs' || requested === 'directory' || requested === 'manage' || requested === 'rebuild') {
      setTab(requested)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Shared
  // ---------------------------------------------------------------------------

  const [competitions, setCompetitions] =
    useState<Competition[]>([])

  const [teamRegistrations, setTeamRegistrations] =
    useState<TeamRegistration[]>([])

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

  const [resolvedPlayers, setResolvedPlayers] = useState<PlayerMapping[]>([])
  const [opponentPlayers, setOpponentPlayers] = useState<string[]>([])
  const [unresolvedPlayers, setUnresolvedPlayers] = useState<string[]>([])
  const [importValidation, setImportValidation] = useState<ImportValidation>({
    errors: ['Upload Ballchasing players-games.csv to begin validation.'],
    warnings: [],
    expectedFrRows: 0,
    resolvedFrRows: 0,
    opponentRows: 0,
    replayIds: 0,
    coverage: { total: 0, basic: 0, movement: 0, positioning: 0, zeroBoost: 0 },
  })

  const [playersSummaryFile, setPlayersSummaryFile] = useState('')
  const [playersSummaryRows, setPlayersSummaryRows] = useState<PlayerSummaryRow[]>([])
  const [playersSummaryCoverage, setPlayersSummaryCoverage] = useState<TrackingCoverage>({
    total: 0, basic: 0, movement: 0, positioning: 0, zeroBoost: 0,
  })
  const [playersSummaryErrors, setPlayersSummaryErrors] = useState<string[]>([])
  const [playersSummaryReady, setPlayersSummaryReady] = useState(false)

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

  const [prCompetitionId, setPrCompetitionId] =
    useState('')

  const [prScopeAvailable, setPrScopeAvailable] =
    useState(false)

  const [prAudit, setPrAudit] =
    useState({ newMatches: 0, duplicates: 0, conflicts: 0, teams: 0, forfeits: 0, rounds: 0 })

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

  const [rebuildHealth, setRebuildHealth] = useState<RebuildHealth>(EMPTY_REBUILD_HEALTH)

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

  async function loadRebuildHealth() {
    setRebuildHealth((current) => ({ ...current, loading: true, error: '' }))

    const countTable = (table: string) =>
      supabase.from(table).select('*', { count: 'exact', head: true })

    const [
      competitionsCount, teamsCount, playersCount, opponentsCount,
      seriesCount, matchesCount, statsCount, leagueCount, scheduleCount,
      bracketsCount, playoffMatchesCount, seriesRows, matchRows, statRows,
      playerRows, opponentRows, opponentAliasRows,
    ] = await Promise.all([
      countTable('competitions'), countTable('teams'), countTable('players'), countTable('opponents'),
      countTable('series'), countTable('matches'), countTable('match_player_stats'), countTable('league_matches'),
      countTable('scheduled_matches'), countTable('playoff_brackets'), countTable('playoff_matches'),
      supabase.from('series').select('series_id, flop_reset_team_id, notes, competitions(format), teams(format)'),
      supabase.from('matches').select('match_id, series_id, is_forfeit, replay_id, match_date, teams(format)'),
      supabase.from('match_player_stats').select('match_id, percentage_supersonic_speed, percentage_most_back, percentage_defensive_half, percentage_defensive_third, avg_distance_to_ball, zero_boost_pct'),
      supabase.from('players').select('name, aliases').in('name', ['aktionrl', 'droll', 'HuskY']),
      supabase.from('opponents').select('opponent_id, normalized_name').in('normalized_name', ['ohio midlads', 'sbc blue angels']),
      supabase.from('opponent_aliases').select('opponent_id, normalized_alias').in('normalized_alias', ['midlads', 'sbc angels']),
    ])

    const failures = [
      competitionsCount, teamsCount, playersCount, opponentsCount, seriesCount,
      matchesCount, statsCount, leagueCount, scheduleCount, bracketsCount,
      playoffMatchesCount, seriesRows, matchRows, statRows, playerRows,
      opponentRows, opponentAliasRows,
    ].flatMap((result) => result.error ? [result.error.message] : [])

    const seriesData = (seriesRows.data ?? []) as any[]
    const matchesData = (matchRows.data ?? []) as any[]
    const statsData = (statRows.data ?? []) as any[]
    const replayCounts = new Map<string, number>()
    const playerRowsByMatch = new Map<number, number>()
    for (const row of statsData) {
      playerRowsByMatch.set(Number(row.match_id), (playerRowsByMatch.get(Number(row.match_id)) ?? 0) + 1)
    }
    for (const row of matchesData) {
      if (row.replay_id) replayCounts.set(row.replay_id, (replayCounts.get(row.replay_id) ?? 0) + 1)
    }
    const legacyForfeitSeries = new Set(
      matchesData.filter((row) => row.is_forfeit && row.series_id !== null).map((row) => Number(row.series_id)),
    )
    for (const row of seriesData) {
      if (String(row.notes ?? '').toLocaleLowerCase('en-US').includes('forfeit')) {
        legacyForfeitSeries.add(Number(row.series_id))
      }
    }

    const aliasesByPlayer = new Map(
      ((playerRows.data ?? []) as any[]).map((row) => [row.name, new Set(row.aliases ?? [])]),
    )
    const opponentIds = new Map(
      ((opponentRows.data ?? []) as any[]).map((row) => [row.normalized_name, Number(row.opponent_id)]),
    )
    const aliasesByOpponent = new Map(
      ((opponentAliasRows.data ?? []) as any[]).map((row) => [row.normalized_alias, Number(row.opponent_id)]),
    )
    const playerAliasesValid = aliasesByPlayer.get('aktionrl')?.has('AkTION') === true &&
      aliasesByPlayer.get('droll')?.has('Drollotov') === true &&
      aliasesByPlayer.get('HuskY')?.has('HuskY.G2') === true
    const opponentAliasesValid = opponentIds.get('ohio midlads') === aliasesByOpponent.get('midlads') &&
      opponentIds.get('sbc blue angels') === aliasesByOpponent.get('sbc angels')
    const competitionMismatches = seriesData.filter((row) => {
      const competition = Array.isArray(row.competitions) ? row.competitions[0] : row.competitions
      const team = Array.isArray(row.teams) ? row.teams[0] : row.teams
      return competition?.format !== team?.format
    }).length
    const advancedRows = statsData.filter((row) => [
      row.percentage_supersonic_speed,
      row.percentage_most_back,
      row.percentage_defensive_half,
      row.percentage_defensive_third,
      row.avg_distance_to_ball,
      row.zero_boost_pct,
    ].some((value) => value !== null && value !== undefined)).length

    const counts = {
      competitions: competitionsCount.count ?? 0,
      teams: teamsCount.count ?? 0,
      players: playersCount.count ?? 0,
      opponents: opponentsCount.count ?? 0,
      series: seriesCount.count ?? 0,
      matches: matchesCount.count ?? 0,
      playerStats: statsCount.count ?? 0,
      leagueMatches: leagueCount.count ?? 0,
      scheduledMatches: scheduleCount.count ?? 0,
      playoffBrackets: bracketsCount.count ?? 0,
      playoffMatches: playoffMatchesCount.count ?? 0,
      forfeits: legacyForfeitSeries.size,
      playedGames: matchesData.filter((row) => !row.is_forfeit && row.series_id !== null).length,
      replayIds: matchesData.filter((row) => Boolean(row.replay_id)).length,
      duplicateReplayIds: [...replayCounts.values()].filter((count) => count > 1).length,
      teamsRepresented: new Set(seriesData.map((row) => row.flop_reset_team_id).filter(Boolean)).size,
      advancedRows,
      orphanPlayerRows: statsData.filter((row) => !matchesData.some((match) => Number(match.match_id) === Number(row.match_id))).length,
      wrongPlayerRowGames: matchesData.filter((row) => {
        if (row.is_forfeit) return false
        const team = Array.isArray(row.teams) ? row.teams[0] : row.teams
        const expected = team?.format === '3v3' ? 3 : team?.format === '2v2' ? 2 : 0
        return expected > 0 && (playerRowsByMatch.get(Number(row.match_id)) ?? 0) !== expected
      }).length,
      seriesWithoutGames: seriesData.filter((series) =>
        !String(series.notes ?? '').toLocaleLowerCase('en-US').includes('forfeit') &&
        !matchesData.some((match) => Number(match.series_id) === Number(series.series_id)),
      ).length,
      playedGamesWithoutStats: matchesData.filter((row) => !row.is_forfeit && !playerRowsByMatch.has(Number(row.match_id))).length,
      forfeitGameRows: matchesData.filter((row) => row.is_forfeit).length,
    }

    setRebuildHealth({
      loading: false,
      error: [...new Set(failures)].join(' · '),
      counts,
      checks: {
        competitionMismatches,
        playerAliasesValid,
        opponentAliasesValid,
        structuralTablesValid: counts.competitions > 0 && counts.teams > 0 &&
          counts.players > 0 && counts.opponents > 0,
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(
        ({ data }) => {
          if (!data.session || data.session.user.app_metadata?.site_admin !== true) {
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

      const { data: teamData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, format')
        .order('id')

      if (teamsError) {
        console.error(teamsError)
        return
      }

      const registrations = (teamData ?? []) as TeamRegistration[]
      setTeamRegistrations(registrations)

      if (list.length) {
        const firstId =
          String(list[0].id)

        setCompetitionId(firstId)
        const importDefault = list.find((competition) =>
          registrations.some((team) =>
            team.name === 'Frameshift' && team.format === competition.format
          )
        )
        setImportCompetitionId(String(importDefault?.id ?? list[0].id))
        setScheduleCompetitionId(firstId)
        setPrCompetitionId(firstId)
      }

      const scopeProbe = await supabase
        .from('league_matches')
        .select('competition_id')
        .limit(1)

      setPrScopeAvailable(!scopeProbe.error)
    }

    loadCompetitions()
    loadScheduled()
    loadManageData()
    loadRebuildHealth()
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
  // Import helpers
  // ---------------------------------------------------------------------------

  function resetExistingSeriesCheck() {
    setImportMode('new')
    setExistingSeriesId(null)
    setExistingSeriesMessage('')
    setBackfillMappings([])
  }

  function clearImportPreview() {
    setPlayersSummaryFile('')
    setPlayersSummaryRows([])
    setPlayersSummaryCoverage({ total: 0, basic: 0, movement: 0, positioning: 0, zeroBoost: 0 })
    setPlayersSummaryErrors([])
    setPlayersSummaryReady(false)
    clearReplayPreview()
  }

  function clearReplayPreview() {
    setGames([])
    setPlayerStats([])
    setImportOpponent('')
    setImportDate('')
    setImportBestOf('')
    setResolvedPlayers([])
    setOpponentPlayers([])
    setUnresolvedPlayers([])
    setImportValidation({
      errors: ['Upload the required Ballchasing players-games.csv source.'],
      warnings: [],
      expectedFrRows: 0,
      resolvedFrRows: 0,
      opponentRows: 0,
      replayIds: 0,
      coverage: { total: 0, basic: 0, movement: 0, positioning: 0, zeroBoost: 0 },
    })

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
        Number(csv.shots) &&

      Number(existing.score ?? 0) ===
        Number(csv.score)
    )
  }

  function gameMatchesExistingMatch(
    game: Game,
    existingMatch: ExistingMatch,
    existingStats: ExistingPlayerStat[],
    csvStats: PlayerStat[]
  ) {
    if (game.ourGoals === null || game.theirGoals === null) return false
    if (existingMatch.replay_id) return existingMatch.replay_id === game.replayId

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

      const replayIds = parsedGames.map((game) => game.replayId)
      const { data: storedReplays, error: replayError } = await supabase
        .from('matches')
        .select('match_id, replay_id, series_id')
        .in('replay_id', replayIds)

      if (replayError) throw replayError
      if (storedReplays?.length) {
        setImportMode('conflict')
        setExistingSeriesId(storedReplays[0].series_id ?? null)
        setBackfillMappings([])
        setExistingSeriesMessage(
          `Duplicate replay detected. ${storedReplays.length} replay ID(s) are already stored; import is blocked.`
        )
        return
      }

      const {
        data: candidates,
        error: seriesError,
      } = await supabase
        .from('series')
        .select(
          'series_id, competition_id, opponent_name, series_date, best_of'
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
        competitionId: number
        bestOf: number | null
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

            competitionId:
              candidate.competition_id,

            bestOf:
              candidate.best_of,

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

        if (match.bestOf) setImportBestOf(String(match.bestOf))

        if (Number(match.competitionId) !== Number(competition.id)) {
          setImportMode('conflict')
          setExistingSeriesMessage(
            `Existing Series #${match.seriesId} was verified by date, team, opponent, game count, scores, and player box scores, but it is attached to Competition #${match.competitionId} instead of the selected ${competition.format} competition. Apply the audited competition-history repair before backfilling.`
          )
          return
        }

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
      importDate &&
      importValidation.errors.length === 0
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
    importValidation.errors.length,
  ])

  // ---------------------------------------------------------------------------
  // CSV parse
  // ---------------------------------------------------------------------------

  function handlePlayersFile(
    file: File
  ) {
    setPlayersSummaryFile('')
    setPlayersSummaryRows([])
    setPlayersSummaryCoverage({ total: 0, basic: 0, movement: 0, positioning: 0, zeroBoost: 0 })
    setPlayersSummaryErrors([])
    setPlayersSummaryReady(false)

    if (!games.length) clearReplayPreview()

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

    setImportMessage('Reading Ballchasing players.csv...')

    Papa.parse(file, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results: any) => {
        const fields: string[] = results.meta?.fields ?? []
        const detection = detectBallchasingFile(fields)
        if (detection.type === 'players-games') {
          const error = 'This appears to be players-games.csv. Upload it in the required canonical source field.'
          setPlayersSummaryErrors([error])
          setImportMessage(error)
          return
        }
        if (detection.type !== 'players') {
          const missing = detection.missingBasicHeaders.length
            ? ` Missing: ${detection.missingBasicHeaders.join(', ')}.`
            : ''
          const error = `This is not a supported Ballchasing players.csv export.${missing}`
          setPlayersSummaryErrors([error])
          setImportMessage(error)
          return
        }

        const summaryRows = (results.data as Record<string, unknown>[])
          .map(mapPlayersCsvRow)
          .filter((row) => row.playerName && row.teamName && row.games > 0)
        if (!summaryRows.length) {
          const error = 'No valid aggregate player rows were found in players.csv.'
          setPlayersSummaryErrors([error])
          setImportMessage(error)
          return
        }

        const sides = new Map<string, PlayerSummaryRow[]>()
        for (const row of summaryRows) {
          const key = normalizeImportIdentity(row.teamName)
          sides.set(key, [...(sides.get(key) ?? []), row])
        }
        const sideCandidates = [...sides.values()].map((rows) => ({
          rows,
          identities: rows.map((row) => resolveRosterIdentity(row.playerName, rosterPlayers)),
        }))
        const selectedKey = normalizeImportIdentity(importTeam)
        let frSide = [...sides.entries()].find(([key]) => key === selectedKey)?.[1]
        if (!frSide) {
          const rosterSides = sideCandidates.filter((side) => side.identities.some(Boolean))
          if (rosterSides.length === 1) frSide = rosterSides[0].rows
        }

        const errors: string[] = []
        if (sides.size !== 2) errors.push(`Expected exactly two team sides in players.csv; found ${sides.size}.`)
        if (!frSide) errors.push('Could not identify one unambiguous Flop Reset side in players.csv.')
        const frRows = frSide ?? []
        const frIdentities = frRows.map((row) => ({ row, identity: resolveRosterIdentity(row.playerName, rosterPlayers) }))
        const unresolved = frIdentities.filter(({ identity }) => !identity).map(({ row }) => row.playerName)
        if (unresolved.length) errors.push(`Unresolved Flop Reset players: ${unresolved.join(', ')}.`)

        const selectedCompetition = competitions.find((competition) => String(competition.id) === importCompetitionId)
        const expectedPerReplay = expectedPlayersForFormat(selectedCompetition?.format ?? '')
        const rowGames = frRows.reduce((sum, row) => sum + row.games, 0)
        const opponentRows = [...sides.values()].find((rows) => rows !== frSide) ?? []
        const opponentRowGames = opponentRows.reduce((sum, row) => sum + row.games, 0)
        if (!expectedPerReplay) errors.push('Unsupported or unknown competition format.')
        if (expectedPerReplay && rowGames % expectedPerReplay !== 0) {
          errors.push(`${rowGames} Flop Reset player-game samples cannot form complete ${selectedCompetition?.format} replays.`)
        }
        if (rowGames !== opponentRowGames) {
          errors.push(`Team sample counts disagree: Flop Reset ${rowGames}, opponent ${opponentRowGames}.`)
        }

        const coverage = getPlayersCsvCoverage(frRows)
        setPlayersSummaryFile(file.name)
        setPlayersSummaryRows(frRows)
        setPlayersSummaryCoverage(coverage)
        const validatorErrors = [...errors]

        if (games.length) {
          if (rowGames !== playerStats.length) {
            validatorErrors.push(`players.csv covers ${rowGames} Flop Reset player-game samples, but players-games.csv resolved ${playerStats.length}.`)
          }
          for (const { row, identity } of frIdentities) {
            if (!identity) continue
            const detailedRows = playerStats.filter((stat) => stat.playerId === identity.player.player_id)
            const comparisons = [
              ['games', row.games, detailedRows.length],
              ['goals', row.basic.goals, detailedRows.reduce((sum, stat) => sum + stat.goals, 0)],
              ['assists', row.basic.assists, detailedRows.reduce((sum, stat) => sum + stat.assists, 0)],
              ['saves', row.basic.saves, detailedRows.reduce((sum, stat) => sum + stat.saves, 0)],
              ['shots', row.basic.shots, detailedRows.reduce((sum, stat) => sum + stat.shots, 0)],
              ['score', row.basic.score, detailedRows.reduce((sum, stat) => sum + stat.score, 0)],
            ] as const
            for (const [field, summaryValue, detailedValue] of comparisons) {
              if (summaryValue !== null && Number(summaryValue) !== Number(detailedValue)) {
                validatorErrors.push(`${identity.player.name}: players.csv ${field} (${summaryValue}) does not match players-games.csv (${detailedValue}).`)
              }
            }
          }
          setPlayersSummaryErrors(validatorErrors)
          setPlayersSummaryReady(validatorErrors.length === 0)
          if (validatorErrors.length) {
            setImportMode('conflict')
            setExistingSeriesMessage('Optional aggregate validation disagrees with the canonical source. Import is blocked.')
          }
          setImportMessage(validatorErrors.length
            ? `Optional players.csv validator found ${validatorErrors.length} blocking mismatch(es).`
            : `Optional players.csv validator agrees with all ${playerStats.length} canonical player-game rows.`)
        } else {
          setPlayersSummaryErrors(errors)
          setPlayersSummaryReady(errors.length === 0)
          setResolvedPlayers(frIdentities.flatMap(({ row, identity }) => identity ? [{
            rawName: row.playerName,
            canonicalName: identity.player.name,
          }] : []))
          setOpponentPlayers(opponentRows.map((row) => row.playerName))
          setUnresolvedPlayers(unresolved)
          setImportValidation({
            errors: errors.length ? errors : ['Upload the required players-games.csv source to prove exact game destinations.'],
            warnings: [
              'players.csv is optional aggregate validation only; its averages are never copied into per-game rows.',
              ...(!detection.movement ? ['Movement tracking is not included in this export.'] : []),
              ...(!detection.positioning ? ['Positioning tracking is not included in this export.'] : []),
              ...(!detection.zeroBoost ? ['Zero-boost tracking is not included in this export.'] : []),
            ],
            expectedFrRows: rowGames,
            resolvedFrRows: rowGames,
            opponentRows: opponentRowGames,
            replayIds: 0,
            coverage,
          })
          setImportMessage(errors.length
            ? `players.csv detected, but ${errors.length} blocking validation error(s) remain.`
            : `Optional players.csv validator detected. ${rowGames} Flop Reset player-game samples are covered; upload players-games.csv to validate the canonical write source.`)
        }
      },
      error: (error) => setImportMessage(`CSV parse error: ${error.message}`),
    })
  }

  function handlePlayerGamesFile(
    file: File
  ) {
    clearReplayPreview()

    if (!importCompetitionId) {
      setImportMessage('Select a competition before uploading a CSV.')
      return
    }

    if (rosterPlayers.length === 0) {
      setImportMessage('No roster players were found for this team and format.')
      return
    }

    setImportMessage('Reading canonical Ballchasing players-games.csv...')

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

        if (detectBallchasingFile(fields).type !== 'players-games') {
          setImportMessage(
            'Canonical source not detected. Choose a Ballchasing players-games.csv export here.'
          )
          return
        }

        const normalizedFields = new Set(fields.map((field) => field.trim().toLocaleLowerCase('en-US')))
        const requiredDetailHeaders = ['replay id', 'team name', 'player name', 'goals', 'assists', 'saves', 'shots', 'score']
        const missingDetailHeaders = requiredDetailHeaders.filter((field) => !normalizedFields.has(field))
        if (missingDetailHeaders.length) {
          setImportMessage(`players-games.csv is missing required box-score headers: ${missingDetailHeaders.join(', ')}.`)
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

        const resolvedMappings = new Map<string, string>()
        const opponentNames = new Set<string>()
        const unresolvedNames = new Set<string>()
        const validationErrors = new Set<string>()
        const validationWarnings = new Set<string>()
        let opponentRowCount = 0

        let detectedOpponent =
          ''

        const selectedCompetition = competitions.find(
          (competition) => String(competition.id) === importCompetitionId
        )
        const selectedFormat = selectedCompetition?.format ?? ''
        const expectedPerReplay = expectedPlayersForFormat(selectedFormat)

        if (!selectedCompetition) validationErrors.add('Unknown competition.')
        if (!expectedPerReplay) validationErrors.add('Unsupported or unknown competition format.')

        Object.entries(
          byReplay
        ).forEach(
          ([
            replayId,
            playersInGame,
          ]) => {
            const sideResolution = identifyReplaySides({
              selectedTeam: importTeam,
              format: selectedFormat,
              roster: rosterPlayers,
              rows: playersInGame.map((row) => ({
                rawName: textFrom(row, 'player name'),
                teamName: textFrom(row, 'team name', 'team'),
                goals: nullableNumberFrom(row, 'goals'),
                source: row,
              })),
            })

            for (const error of sideResolution.errors) {
              validationErrors.add(`${replayId.slice(0, 8)}: ${error}`)
            }
            for (const name of sideResolution.unresolvedFrNames) unresolvedNames.add(name)
            for (const name of sideResolution.opponentPlayerNames) opponentNames.add(name)
            opponentRowCount += sideResolution.opponentRows.length
            for (const identity of sideResolution.resolved) {
              resolvedMappings.set(identity.rawName, identity.player.name)
            }

            if (!detectedOpponent && sideResolution.opponentTeamName) {
              detectedOpponent = sideResolution.opponentTeamName
            } else if (
              detectedOpponent &&
              sideResolution.opponentTeamName &&
              normalizeImportIdentity(detectedOpponent) !== normalizeImportIdentity(sideResolution.opponentTeamName)
            ) {
              validationErrors.add('Opponent team identity changes between replays.')
            }

            const ourGoals = sideResolution.ourGoals
            const theirGoals = sideResolution.theirGoals

            sideResolution.frRows.forEach(
              ({ row: identityRow, identity }) => {
                const row = identityRow.source as Record<string, any>
                const player =
                  identity?.player ?? null

                const goals =
                  identityRow.goals ?? 0

                if (player) {
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
              error: sideResolution.errors.length
                ? 'Roster resolution incomplete'
                : undefined,
            })
          }
        )

        setGames(
          parsedGames
        )

        setPlayerStats(
          parsedStats
        )

        const expectedFrRows = (expectedPerReplay ?? 0) * parsedGames.length
        if (expectedFrRows !== parsedStats.length) {
          validationErrors.add(
            `Expected ${expectedFrRows} Flop Reset player-game rows; resolved ${parsedStats.length}.`
          )
        }
        if (new Set(parsedStats.map((stat) => stat.playerId)).size > (expectedPerReplay ?? 0)) {
          validationWarnings.add('Roster substitution detected between replays.')
        }
        if (parsedStats.every((stat) => stat.percentageSupersonicSpeed === null)) {
          validationWarnings.add('Advanced tracking is unavailable in this CSV.')
        }
        if (detectedOpponent) {
          validationWarnings.add('Opponent identity is taken from the explicit CSV team grouping.')
        }

        for (const summaryRow of playersSummaryRows) {
          const identity = resolveRosterIdentity(summaryRow.playerName, rosterPlayers)
          if (!identity) continue
          const detailedRows = parsedStats.filter((stat) => stat.playerId === identity.player.player_id)
          const comparisons = [
            ['games', summaryRow.games, detailedRows.length],
            ['goals', summaryRow.basic.goals, detailedRows.reduce((sum, stat) => sum + stat.goals, 0)],
            ['assists', summaryRow.basic.assists, detailedRows.reduce((sum, stat) => sum + stat.assists, 0)],
            ['saves', summaryRow.basic.saves, detailedRows.reduce((sum, stat) => sum + stat.saves, 0)],
            ['shots', summaryRow.basic.shots, detailedRows.reduce((sum, stat) => sum + stat.shots, 0)],
            ['score', summaryRow.basic.score, detailedRows.reduce((sum, stat) => sum + stat.score, 0)],
          ] as const
          for (const [field, summaryValue, detailedValue] of comparisons) {
            if (summaryValue !== null && Number(summaryValue) !== Number(detailedValue)) {
              validationErrors.add(
                `${identity.player.name}: players.csv ${field} (${summaryValue}) does not match players-games.csv (${detailedValue}).`,
              )
            }
          }
        }

        const detailedCoverage: TrackingCoverage = {
          total: parsedStats.length,
          basic: parsedStats.length,
          movement: parsedStats.filter((stat) =>
            stat.percentageSupersonicSpeed !== null ||
            stat.percentageOnGround !== null ||
            stat.percentageLowAir !== null ||
            stat.percentageHighAir !== null,
          ).length,
          positioning: parsedStats.filter((stat) =>
            stat.percentageMostBack !== null ||
            stat.percentageDefensiveHalf !== null ||
            stat.percentageDefensiveThird !== null ||
            stat.avgDistanceToBall !== null,
          ).length,
          zeroBoost: parsedStats.filter((stat) => stat.zeroBoostPct !== null).length,
        }
        if (playersSummaryReady && detailedCoverage.total !== playersSummaryCoverage.total) {
          validationErrors.add(
            `players.csv covers ${playersSummaryCoverage.total} Flop Reset player-game samples, but players-games.csv resolved ${detailedCoverage.total}.`,
          )
        }
        validationWarnings.add('Confirm the scheduled odd best-of value manually; it is not inferred from games played.')

        const errors = [...validationErrors]
        setResolvedPlayers([...resolvedMappings.entries()].map(([rawName, canonicalName]) => ({
          rawName,
          canonicalName,
        })))
        setOpponentPlayers([...opponentNames])
        setUnresolvedPlayers([...unresolvedNames])
        setImportValidation({
          errors,
          warnings: [...validationWarnings],
          expectedFrRows,
          resolvedFrRows: parsedStats.length,
          opponentRows: opponentRowCount,
          replayIds: parsedGames.filter((game) => game.replayId).length,
          coverage: detailedCoverage,
        })

        if (errors.length) {
          setImportMode('conflict')
          setExistingSeriesMessage('Roster or team-side validation failed. Import is blocked.')
        }

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

        setImportBestOf('')

        setImportMessage(
          errors.length
            ? `Parsed ${parsedGames.length} game(s), but validation found ${errors.length} blocking error(s).`
            : `Canonical players-games.csv parsed: ${parsedGames.length} game(s) and ${parsedStats.length} resolved Flop Reset player-game rows.`
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
      'new' ||
      !safeToImport
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
            `Imported via canonical Ballchasing players-games.csv workflow — ${importOpponent}`,
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

        await loadRebuildHealth()
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
      !safeToImport ||
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
            nonNullUpdate(processSkillUpdate(item.stat))
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

      const finalFlopScore =
        isForfeit
          ? 0
          : Number(
              flopScore
            )

      const finalOpponentScore =
        isForfeit
          ? 0
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

          best_of:
            isForfeit
              ? null
              : 1,

          is_forfeit:
            isForfeit,

          result_override:
            isForfeit
              ? forfeitResult
              : null,

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

      if (!isForfeit) {
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
              false,

            result_override:
              null,

            match_date:
              matchDate,

            round:
              matchRound ||
              null,
          })

        if (matchError) {
          await supabase.from('series').delete().eq('series_id', series.series_id)
          throw matchError
        }
      }

      setMessage(
        isForfeit
          ? 'Forfeit series saved with a 0–0 public score, zero game rows, and zero player rows.'
          : 'Match saved!'
      )

      setOpponentName('')
      setFlopScore('')
      setOpponentScore('')
      setMatchDate('')
      setIsForfeit(false)
      setForfeitResult('win')
      setMatchRound('')

      loadManageData()
      loadRebuildHealth()
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

  async function handlePrParse() {
    try {
      if (!prScopeAvailable) {
        setPrMessage('Import blocked: apply and backfill the prepared competition-scoping migration before adding another ranking batch.')
        return
      }
      const selected = competitions.find((competition) => String(competition.id) === prCompetitionId)
      if (!selected || selected.format !== prFormat) {
        setPrMessage(`Choose a ${prFormat} competition before parsing.`)
        return
      }
      const parsed =
        parseLeagueMatches(
          prText
        )

      const { data: existing } = await supabase
        .from('league_matches')
        .select('round, tier, team_a, team_b, score_a, score_b, status')
        .eq('competition_id', prCompetitionId)
        .eq('format', prFormat)

      const identity = (match: any) => [match.round, match.tier, match.team_a, match.team_b].join('|').toLowerCase()
      const result = (match: any) => [match.score_a, match.score_b, match.status].join('|').toLowerCase()
      const existingByIdentity = new Map((existing ?? []).map((match: any) => [identity(match), result(match)]))
      let duplicates = 0
      let conflicts = 0
      const fresh = parsed.filter((match: any) => {
        const prior = existingByIdentity.get(identity(match))
        if (prior === undefined) return true
        if (prior === result(match)) duplicates += 1
        else conflicts += 1
        return false
      })

      setPrPreview(fresh)
      setPrAudit({
        newMatches: fresh.length,
        duplicates,
        conflicts,
        teams: new Set(parsed.flatMap((match: any) => [match.team_a, match.team_b]).filter(Boolean)).size,
        forfeits: parsed.filter((match: any) => match.score_a === 'FFW' || match.score_a === 'FFL').length,
        rounds: new Set(parsed.map((match: any) => match.round)).size,
      })

      setPrMessage(
        `Preview ready: ${fresh.length} new, ${duplicates} duplicates, ${conflicts} conflicts.`
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
    if (!prScopeAvailable || !prCompetitionId) {
      setPrMessage('Import blocked: competition ownership is required.')
      return
    }
    if (prAudit.conflicts > 0) {
      setPrMessage('Import blocked: resolve conflicting results before confirmation.')
      return
    }
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
          competition_id:
            Number(prCompetitionId),
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

  const selectedImportCompetition = competitions.find(
    (competition) => String(competition.id) === importCompetitionId
  )
  const selectedTeamFormats = new Set(
    teamRegistrations
      .filter((team) => team.name === importTeam)
      .map((team) => team.format)
  )
  const compatibleImportCompetitions = competitions.filter(
    (competition) => selectedTeamFormats.size === 0 || selectedTeamFormats.has(competition.format)
  )
  const compatibleImportTeams = [...new Set(
    teamRegistrations
      .filter((team) => team.format === selectedImportCompetition?.format)
      .map((team) => team.name)
  )]
  const intendedBestOf = Number(importBestOf)
  const bestOfValid = Number.isInteger(intendedBestOf) &&
    intendedBestOf >= games.length && intendedBestOf > 0 && intendedBestOf % 2 === 1
  const targetRegistration = teamRegistrations.find(
    (team) => team.name === importTeam && team.format === selectedImportCompetition?.format
  )
  const previewErrors = games.length ? [
    ...playersSummaryErrors,
    ...importValidation.errors,
    ...(!selectedImportCompetition ? ['Unknown competition.'] : []),
    ...(!targetRegistration ? ['Selected team is not registered in the competition format.'] : []),
    ...(!importOpponent.trim() ? ['Opponent identity is missing.'] : []),
    ...(!importDate ? ['Series date is missing.'] : []),
    ...(!bestOfValid ? ['A valid odd best-of value is required.'] : []),
  ] : [...playersSummaryErrors, ...importValidation.errors]
  const safeToImport = games.length > 0 && previewErrors.length === 0 &&
    (importMode === 'new' || importMode === 'backfill')
  const rebuildReady = !rebuildHealth.loading && !rebuildHealth.error &&
    rebuildHealth.checks.competitionMismatches === 0 &&
    rebuildHealth.checks.playerAliasesValid &&
    rebuildHealth.checks.opponentAliasesValid &&
    rebuildHealth.checks.structuralTablesValid &&
    rebuildHealth.counts.duplicateReplayIds === 0
  const advancedCoverage = rebuildHealth.counts.playerStats > 0
    ? Math.round((rebuildHealth.counts.advancedRows / rebuildHealth.counts.playerStats) * 100)
    : null

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  return (
    <main className={`mx-auto w-full min-w-0 px-4 py-12 md:px-8 ${tab === 'playoffs' || tab === 'directory' ? 'max-w-7xl' : 'max-w-3xl'}`}>
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
          onClick={() => {
            setTab('rebuild')
            loadRebuildHealth()
          }}
          className={tabClass('rebuild')}
        >
          Data Health
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
          onClick={() => setTab('playoffs')}
          className={tabClass('playoffs')}
        >
          Playoffs
        </button>

        <button
          onClick={() => setTab('directory')}
          className={tabClass('directory')}
        >
          League Directory
        </button>

        <button
          onClick={() =>
            setTab('manage')
          }
          className={
            tabClass('manage')
          }
        >
          Matches
        </button>
      </div>

      {tab === 'rebuild' && (
        <div className="space-y-6">
          <section className={`rounded-2xl border p-6 ${rebuildReady ? 'border-emerald-800 bg-emerald-950/15' : 'border-red-900 bg-red-950/15'}`}>
            <div className="text-xs font-black uppercase tracking-[.2em] text-neutral-500">Summer Rebuild Control Plane</div>
            <div className={`mt-2 text-2xl font-black ${rebuildReady ? 'text-emerald-400' : 'text-red-400'}`}>
              {rebuildHealth.loading ? 'CHECKING LIVE DATA…' : rebuildReady ? 'READY FOR CONTROLLED RESET' : 'NOT READY'}
            </div>
            <p className="mt-3 text-sm text-neutral-400">
              The production reset remains a manual SQL operation. There is intentionally no destructive button on this page.
            </p>
            <button type="button" onClick={loadRebuildHealth} className="mt-4 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-300 hover:border-purple-700">
              Refresh live checks
            </button>
            {rebuildHealth.error && <p className="mt-3 text-xs text-red-300">{rebuildHealth.error}</p>}
          </section>

          <section className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-5">
            <div className="text-xs font-black uppercase tracking-[.18em] text-purple-300">Pre-reset snapshot</div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Imported Series', rebuildHealth.counts.series],
                ['Played Games', rebuildHealth.counts.playedGames],
                ['Player-Game Rows', rebuildHealth.counts.playerStats],
                ['Forfeits', rebuildHealth.counts.forfeits],
                ['Replay IDs', rebuildHealth.counts.replayIds],
                ['League Rows', rebuildHealth.counts.leagueMatches],
                ['Teams Represented', rebuildHealth.counts.teamsRepresented],
                ['Advanced Coverage', advancedCoverage === null ? '—' : `${advancedCoverage}%`],
              ].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-neutral-800 bg-black/20 p-3"><div className="text-xs text-neutral-500">{label}</div><div className="mt-1 text-xl font-black text-white">{value}</div></div>)}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            {[
              ['Competition Integrity', rebuildHealth.checks.competitionMismatches === 0, `${rebuildHealth.checks.competitionMismatches} format mismatches`],
              ['Player Identity', rebuildHealth.checks.playerAliasesValid, 'AkTION, Drollotov, HuskY.G2'],
              ['Opponent Identity', rebuildHealth.checks.opponentAliasesValid, 'Ohio Midlads and SBC Blue Angels'],
              ['Replay Integrity', rebuildHealth.counts.duplicateReplayIds === 0, `${rebuildHealth.counts.duplicateReplayIds} duplicate replay IDs`],
              ['Player Row Integrity', rebuildHealth.counts.orphanPlayerRows === 0 && rebuildHealth.counts.wrongPlayerRowGames === 0, `${rebuildHealth.counts.orphanPlayerRows} orphan rows · ${rebuildHealth.counts.wrongPlayerRowGames} games with wrong FR row count`],
              ['Series Coverage', rebuildHealth.counts.seriesWithoutGames === 0 && rebuildHealth.counts.playedGamesWithoutStats === 0, `${rebuildHealth.counts.seriesWithoutGames} unexplained empty series · ${rebuildHealth.counts.playedGamesWithoutStats} played games without stats`],
              ['Forfeit Integrity', rebuildHealth.counts.forfeitGameRows === 0, rebuildHealth.counts.forfeitGameRows === 0 ? 'Zero game rows attached to forfeits' : `${rebuildHealth.counts.forfeitGameRows} legacy forfeit game rows queued for reset`],
              ['Structural Identity', rebuildHealth.checks.structuralTablesValid, `${rebuildHealth.counts.competitions} competitions · ${rebuildHealth.counts.teams} teams · ${rebuildHealth.counts.players} players`],
              ['Power Dataset', rebuildHealth.counts.leagueMatches === 0, rebuildHealth.counts.leagueMatches === 0 ? 'REBUILDING' : `${rebuildHealth.counts.leagueMatches} rows queued for reset`],
            ].map(([label, healthy, detail]) => <div key={String(label)} className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4"><div className="flex items-center justify-between gap-3"><span className="font-bold text-white">{label}</span><span className={`text-xs font-black ${healthy ? 'text-emerald-400' : 'text-amber-300'}`}>{healthy ? '✓' : 'REVIEW'}</span></div><div className="mt-2 text-xs text-neutral-500">{detail}</div></div>)}
          </section>

          <section className="rounded-2xl border border-amber-800 bg-amber-950/15 p-5">
            <div className="text-sm font-black text-amber-300">RESET SQL PREPARED</div>
            <p className="mt-2 text-xs leading-5 text-amber-100/70">
              supabase/manual/202608250009_clean_competitive_rebuild.sql creates an internal backup, audits the live foreign-key graph, detaches stale FR playoff links, clears competitive rows in explicit order, and verifies the result. It uses no TRUNCATE and no CASCADE command.
            </p>
          </section>
          <LeagueDirectoryHealth />
        </div>
      )}

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
              <option value="Frameshift">Frameshift</option>
              <option value="Frantic">Frantic</option>
              <option value="Fracture">Fracture</option>
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
            <div className="rounded-xl border border-amber-900 bg-amber-950/15 p-4">
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
              <p className="mt-3 text-xs text-amber-100/70">Creates one official series result with a 0–0 public score, zero game rows, and zero player-stat rows. Do not upload a fake CSV.</p>
            </div>
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
          <div className="mb-6 rounded-xl border border-purple-800 bg-purple-950/20 p-5">
            <div className="text-xs font-black uppercase tracking-[.2em] text-purple-300">Summer Rebuild Mode</div>
            <div className="mt-2 text-2xl font-black text-white">
              {rebuildHealth.counts.series} verified source series imported
            </div>
            <p className="mt-2 text-sm text-neutral-400">
              Source manifest total is not supplied. Every clean upload must reach <strong className="text-emerald-400">SAFE NEW IMPORT</strong> before confirmation.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold">
              <Link href="/matches" className="text-purple-300 hover:underline">Match archive →</Link>
              <Link href="/stats" className="text-purple-300 hover:underline">Stats →</Link>
              <Link href="/records" className="text-purple-300 hover:underline">Records →</Link>
              <Link href="/rivalries" className="text-purple-300 hover:underline">Rivalries →</Link>
            </div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 mb-6">
            <h2 className="font-semibold mb-1">
              Ballchasing Advanced Import
            </h2>

            <p className="text-sm text-neutral-500">
              Upload <strong>players-games.csv</strong> as the required source of truth for
              replay identity, box scores, and per-game tracking. A matching
              <strong> players.csv</strong> may be attached only as an optional aggregate validator.
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
              {compatibleImportCompetitions.map(
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
              {compatibleImportTeams.map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
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

          <label className="block mb-6 rounded-xl border border-purple-900 bg-purple-950/10 p-4">
            <span className="font-black text-white">Required — Ballchasing players-games.csv</span>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handlePlayerGamesFile(file)
              }}
              className="block mt-2"
            />
            <span className="mt-2 block text-xs text-neutral-500">Canonical per-game write source. Supplies replay IDs and exact player-game destinations.</span>
          </label>

          <label className="block mb-6">
            Optional — matching Ballchasing players.csv validator:
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handlePlayersFile(file)
              }}
              className="block mt-2"
            />
            <span className="mt-2 block text-xs text-neutral-500">Aggregate cross-check only. It never writes averages into individual games.</span>
          </label>

          {(playersSummaryFile || playersSummaryErrors.length > 0) && (
            <section className={`mb-6 rounded-xl border p-5 ${playersSummaryReady ? 'border-emerald-900 bg-emerald-950/15' : 'border-red-900 bg-red-950/20'}`}>
              <div className="text-xs font-black uppercase tracking-[.18em] text-purple-300">File Detected</div>
              <div className={`mt-2 font-black ${playersSummaryReady ? 'text-emerald-400' : 'text-red-400'}`}>
                {playersSummaryReady ? 'Optional players.csv validator ✓' : 'Optional validator blocked'}
              </div>
              {playersSummaryFile && <div className="mt-1 break-all text-xs text-neutral-500">{playersSummaryFile}</div>}
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {[
                  ['Basic', playersSummaryCoverage.basic],
                  ['Movement', playersSummaryCoverage.movement],
                  ['Positioning', playersSummaryCoverage.positioning],
                  ['Zero Boost', playersSummaryCoverage.zeroBoost],
                ].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-neutral-800 bg-black/20 p-3"><div className="text-xs text-neutral-500">{label}</div><div className="mt-1 font-black text-white">{value} / {playersSummaryCoverage.total}</div></div>)}
              </div>
              {playersSummaryErrors.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-red-200">{playersSummaryErrors.map((error) => <li key={error}>{error}</li>)}</ul>}
              {playersSummaryReady && <p className="mt-4 text-xs text-neutral-500">Aggregate coverage verified. Replay identity is intentionally unavailable in players.csv.</p>}
            </section>
          )}

          {importMessage && (
            <p className="text-neutral-300 mb-4">
              {
                importMessage
              }
            </p>
          )}

          {games.length > 0 && (
            <div>
              <section className="mb-6 rounded-xl border border-neutral-800 bg-neutral-950/60 p-5">
                <div className="text-xs font-black uppercase tracking-[.18em] text-purple-300">Import Target</div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-neutral-500">Competition</dt><dd className="font-semibold text-white">{selectedImportCompetition ? formatCompetitionAdminLabel(selectedImportCompetition) : '—'}</dd></div>
                  <div><dt className="text-neutral-500">Format</dt><dd className="font-semibold text-white">{selectedImportCompetition?.format ?? '—'}</dd></div>
                  <div><dt className="text-neutral-500">Team</dt><dd className="font-semibold text-white">{importTeam}</dd></div>
                  <div><dt className="text-neutral-500">Opponent</dt><dd className="font-semibold text-white">{importOpponent || '—'}</dd></div>
                  <div><dt className="text-neutral-500">Date</dt><dd className="font-semibold text-white">{importDate ? formatPublicDate(importDate) : '—'}</dd></div>
                  <div><dt className="text-neutral-500">Games / Best Of</dt><dd className="font-semibold text-white">{games.length} / {bestOfValid ? intendedBestOf : '—'}</dd></div>
                  <div><dt className="text-neutral-500">Expected FR player rows</dt><dd className="font-semibold text-white">{importValidation.expectedFrRows}</dd></div>
                  <div><dt className="text-neutral-500">Resolved FR player rows</dt><dd className="font-semibold text-white">{importValidation.resolvedFrRows}</dd></div>
                  <div><dt className="text-neutral-500">Opponent player rows</dt><dd className="font-semibold text-white">{importValidation.opponentRows}</dd></div>
                  <div><dt className="text-neutral-500">Replay IDs</dt><dd className="font-semibold text-white">{importValidation.replayIds} / {games.length}</dd></div>
                  <div><dt className="text-neutral-500">Existing Series</dt><dd className="font-semibold text-white">{existingSeriesId ? `Series #${existingSeriesId}` : importMode === 'checking' ? 'Checking…' : 'None verified'}</dd></div>
                  <div><dt className="text-neutral-500">Status</dt><dd className={`font-black ${safeToImport ? 'text-emerald-400' : 'text-red-400'}`}>{safeToImport ? importMode === 'backfill' ? 'SAFE BACKFILL' : 'SAFE NEW IMPORT' : importMode === 'checking' ? 'CHECKING' : 'IMPORT BLOCKED'}</dd></div>
                </dl>
              </section>

              <section className="mb-6 rounded-xl border border-neutral-800 bg-neutral-950/60 p-5">
                <div className="text-xs font-black uppercase tracking-[.18em] text-purple-300">Tracking Coverage</div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  {[
                    ['Basic', importValidation.coverage.basic],
                    ['Movement', importValidation.coverage.movement],
                    ['Positioning', importValidation.coverage.positioning],
                    ['Zero Boost', importValidation.coverage.zeroBoost],
                  ].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-neutral-800 bg-black/20 p-3"><div className="text-xs text-neutral-500">{label}</div><div className="mt-1 font-black text-white">{value} / {importValidation.coverage.total}</div></div>)}
                </div>
              </section>

              <section className="mb-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-emerald-900 bg-emerald-950/15 p-4"><div className="text-xs font-black uppercase text-emerald-400">Flop Reset Players Resolved</div><div className="mt-2 space-y-1 text-sm text-neutral-300">{resolvedPlayers.length ? resolvedPlayers.map((mapping) => <div key={`${mapping.rawName}-${mapping.canonicalName}`}>{mapping.rawName} → <span className="font-semibold text-white">{mapping.canonicalName}</span></div>) : <div>None</div>}</div></div>
                <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4"><div className="text-xs font-black uppercase text-neutral-400">Opponent Players</div><div className="mt-2 text-sm text-neutral-300">{opponentPlayers.length ? opponentPlayers.join(', ') : 'None identified'}</div></div>
                <div className={`rounded-lg border p-4 ${unresolvedPlayers.length ? 'border-red-900 bg-red-950/20' : 'border-neutral-800 bg-neutral-950/50'}`}><div className={`text-xs font-black uppercase ${unresolvedPlayers.length ? 'text-red-400' : 'text-neutral-400'}`}>Unresolved / Requires Review</div><div className="mt-2 text-sm text-neutral-300">{unresolvedPlayers.length ? unresolvedPlayers.join(', ') : 'None'}</div></div>
              </section>

              {(previewErrors.length > 0 || importValidation.warnings.length > 0) && <section className="mb-6 space-y-3">
                {previewErrors.length > 0 && <div className="rounded-lg border border-red-900 bg-red-950/20 p-4"><div className="text-sm font-black text-red-400">Import blocked</div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-200">{previewErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
                {importValidation.warnings.length > 0 && <div className="rounded-lg border border-amber-900 bg-amber-950/15 p-4"><div className="text-sm font-black text-amber-300">Warnings</div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100">{importValidation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
              </section>}

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
                    ? existingSeriesId ? '⚠ Existing Series Requires Repair' : '⚠ Import Conflict'
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

                {existingSeriesId && (
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
                  (game, index) => (
                    <div
                      key={
                        game.replayId
                      }
                      className="rounded-lg border border-neutral-800 bg-black/20 p-3 text-sm text-neutral-300"
                    >
                      <div className="text-xs font-black uppercase tracking-wide text-purple-300">Game {index + 1}</div>
                      <div className="mt-1">{game.date ? formatPublicDate(game.date) : 'Date unavailable'}</div>
                      <div className="mt-1 font-semibold text-white">{game.ourGoals === null || game.theirGoals === null ? 'Score unavailable' : `${importTeam} ${game.ourGoals}–${game.theirGoals} ${importOpponent}`}</div>
                      {game.error && <div className="mt-1 text-xs text-red-400">{game.error}</div>}
                      <div className="mt-2 break-all text-xs text-neutral-600">Replay: {game.replayId}</div>
                    </div>
                  )
                )}
              </div>

              <h2 className="text-xl font-semibold mb-2">
                Player Resolution
              </h2>

              <div className={`mb-4 rounded-lg border p-4 ${importValidation.resolvedFrRows === importValidation.expectedFrRows && importValidation.expectedFrRows > 0 ? 'border-emerald-900 bg-emerald-950/15' : 'border-red-900 bg-red-950/20'}`}>
                <div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-neutral-500">Expected</span><div className="text-xl font-black text-white">{importValidation.expectedFrRows}</div></div><div><span className="text-neutral-500">Resolved</span><div className="text-xl font-black text-white">{importValidation.resolvedFrRows} / {importValidation.expectedFrRows}</div></div></div>
                <div className={`mt-3 text-sm font-black ${safeToImport ? 'text-emerald-400' : 'text-red-400'}`}>{safeToImport ? '✓ RESOLUTION COMPLETE' : '✕ IMPORT BLOCKED'}</div>
              </div>

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
                  disabled={!safeToImport}
                  className="mt-2 rounded bg-purple-700 px-4 py-2 text-white enabled:hover:bg-purple-600 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
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
                  disabled={!safeToImport}
                  className="mt-2 rounded bg-green-700 px-4 py-2 text-white enabled:hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
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
          {!prScopeAvailable && (
            <div className="mb-5 rounded-xl border border-amber-800 bg-amber-950/20 p-4 text-sm text-amber-200">
              <div className="font-bold">Ranking imports are safely paused</div>
              <p className="mt-1 text-amber-100/70">The live league_matches table has no competition_id yet. Apply and backfill the prepared migration before Fall or any new circuit is imported.</p>
            </div>
          )}
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
            Competition / rating pool:
            <select
              value={prCompetitionId}
              onChange={(e) => setPrCompetitionId(e.target.value)}
              disabled={!prScopeAvailable}
              className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 disabled:opacity-50"
            >
              <option value="">Select competition</option>
              {competitions.filter((competition) => competition.format === prFormat).map((competition) => (
                <option key={competition.id} value={competition.id}>{competition.name} · {competition.format}</option>
              ))}
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
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs sm:grid-cols-3">
                <span>New: <strong className="text-white">{prAudit.newMatches}</strong></span>
                <span>Duplicates: <strong className="text-white">{prAudit.duplicates}</strong></span>
                <span>Conflicts: <strong className={prAudit.conflicts ? 'text-red-400' : 'text-white'}>{prAudit.conflicts}</strong></span>
                <span>Teams: <strong className="text-white">{prAudit.teams}</strong></span>
                <span>Rounds: <strong className="text-white">{prAudit.rounds}</strong></span>
                <span>Forfeits: <strong className="text-white">{prAudit.forfeits}</strong></span>
              </div>
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
                disabled={prAudit.conflicts > 0 || !prScopeAvailable}
                className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirm Import
              </button>
            </div>
          )}
        </div>
      )}

      {/* PLAYOFFS */}

      {tab === 'playoffs' && <PlayoffAdminEditor />}
      {tab === 'directory' && <LeagueDirectoryAdmin />}

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
