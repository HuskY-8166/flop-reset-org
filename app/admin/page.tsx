'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase'
import { parseLeagueMatches } from '@/lib/parseLeagueMatches'

type Game = { replayId: string; date: string; ourGoals: number; theirGoals: number }
type PlayerStat = {
  replayId: string; playerId: number | null; playerName: string
  goals: number; assists: number; saves: number; shots: number; score: number
  bpm: number; avgSpeed: number; timeSupersonic: number
  timeOnGround: number; timeLowAir: number; timeHighAir: number
  timeDef: number; timeNeutral: number; timeOff: number
  demosInflicted: number; demosTaken: number; boostCollected: number; boostStolen: number; zeroBoostTime: number
}

export default function Admin() {
  const [tab, setTab] = useState<'add' | 'import' | 'schedule' | 'rankings' | 'manage'>('add')
  const router = useRouter()

  // Shared
  const [competitions, setCompetitions] = useState<any[]>([])

  // Add Result form
  const [competitionId, setCompetitionId] = useState('')
  const [teamName, setTeamName] = useState('Frameshift')
  const [opponentName, setOpponentName] = useState('')
  const [flopScore, setFlopScore] = useState('')
  const [opponentScore, setOpponentScore] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [isForfeit, setIsForfeit] = useState(false)
  const [forfeitResult, setForfeitResult] = useState('win')
  const [matchRound, setMatchRound] = useState('')
  const [message, setMessage] = useState('')

  // CSV Import
  const [importTeam, setImportTeam] = useState('Frameshift')
  const [importOpponent, setImportOpponent] = useState('')
  const [importDate, setImportDate] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([])
  const [rosterPlayers, setRosterPlayers] = useState<{ player_id: number; name: string }[]>([])
  const [importMessage, setImportMessage] = useState('')

  // Schedule
  const [scheduleTeamName, setScheduleTeamName] = useState('Frameshift')
  const [scheduleCompetitionId, setScheduleCompetitionId] = useState('')
  const [scheduleOpponent, setScheduleOpponent] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleNotes, setScheduleNotes] = useState('')
  const [scheduleMessage, setScheduleMessage] = useState('')
  const [scheduledList, setScheduledList] = useState<any[]>([])

  // Power Rankings
  const [prFormat, setPrFormat] = useState('3v3')
  const [prText, setPrText] = useState('')
  const [prMessage, setPrMessage] = useState('')
  const [prPreview, setPrPreview] = useState<any[]>([])

  // Manage
  const [manageSeries, setManageSeries] = useState<any[]>([])
  const [manageBatches, setManageBatches] = useState<{ batch_label: string; format: string; count: number }[]>([])
  const [mvpMatchId, setMvpMatchId] = useState('')
  const [mvpCandidates, setMvpCandidates] = useState<any[]>([])

  async function loadScheduled() {
    const { data } = await supabase
      .from('scheduled_matches')
      .select('scheduled_id, opponent_name, match_date, match_time, status, teams ( name, format )')
      .order('match_date', { ascending: true })
    setScheduledList(data ?? [])
  }

  async function loadMvpCandidates(matchId: string) {
    const { data } = await supabase
      .from('match_player_stats')
      .select('stat_id, mvp, players ( name )')
      .eq('match_id', matchId)
    setMvpCandidates(data ?? [])
  }

  async function setMvp(statId: number, matchId: string) {
    await supabase.from('match_player_stats').update({ mvp: false }).eq('match_id', matchId)
    await supabase.from('match_player_stats').update({ mvp: true }).eq('stat_id', statId)
    loadMvpCandidates(matchId)
  }

  async function loadRoster(team: string) {
    const { data: teamRow } = await supabase.from('teams').select('id').eq('name', team).limit(1).single()
    if (!teamRow) return
    const { data: players } = await supabase.from('players').select('player_id, name, aliases').eq('team_id', teamRow.id)
    setRosterPlayers(players ?? [])
  }

  async function loadManageData() {
    const { data: seriesData } = await supabase
      .from('series')
      .select('series_id, opponent_name, series_date, teams ( name, format )')
      .order('series_date', { ascending: false })
    setManageSeries(seriesData ?? [])

    const { data: batchData } = await supabase
      .from('league_matches')
      .select('batch_label, format')
    const grouped: Record<string, { format: string; count: number }> = {}
    batchData?.forEach((row: any) => {
      const key = `${row.batch_label}|${row.format}`
      if (!grouped[key]) grouped[key] = { format: row.format, count: 0 }
      grouped[key].count++
    })
    setManageBatches(
      Object.entries(grouped).map(([key, v]) => ({ batch_label: key.split('|')[0], format: v.format, count: v.count }))
    )
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login')
    })

    supabase.from('competitions').select('id, name').then(({ data }) => {
      setCompetitions(data ?? [])
      if (data && data.length > 0) {
        setCompetitionId(data[0].id)
        setScheduleCompetitionId(data[0].id)
      }
    })

    loadScheduled()
    loadRoster(importTeam)
    loadManageData()
  }, [])

  function handleImportTeamChange(team: string) {
    setImportTeam(team)
    loadRoster(team)
  }

  function findMatchingPlayerId(rawName: string, roster: { player_id: number; name: string; aliases?: string[] }[]) {
    const lower = rawName.toLowerCase()
    const exact = roster.find((p) => p.name.toLowerCase() === lower)
    if (exact) return exact
    const aliasMatch = roster.find((p) => (p.aliases ?? []).some((a) => a.toLowerCase() === lower))
    if (aliasMatch) return aliasMatch
    return roster.find((p) => lower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(lower)) ?? null
  }

  function handlePlayersFile(file: File) {
    Papa.parse(file, {
      header: true,
      delimiter: ';',
      complete: (results: any) => {
        const rows = (results.data as any[]).filter((r) => r['replay id'] && r['player name'])

        const byReplay: Record<string, any[]> = {}
        rows.forEach((r) => {
          byReplay[r['replay id']] = byReplay[r['replay id']] || []
          byReplay[r['replay id']].push(r)
        })

        const parsedGames: Game[] = []
        const parsedStats: PlayerStat[] = []
        let detectedOpponent = ''

        Object.entries(byReplay).forEach(([replayId, playersInGame]) => {
          let ourGoals = 0
          let theirGoals = 0

          playersInGame.forEach((r) => {
            const match = findMatchingPlayerId(r['player name'], rosterPlayers)
            const goals = parseInt(r['goals']) || 0

            if (match) {
              ourGoals += goals
              parsedStats.push({
                replayId,
                playerId: match.player_id,
                playerName: match.name,
                goals,
                assists: parseInt(r['assists']) || 0,
                saves: parseInt(r['saves']) || 0,
                shots: parseInt(r['shots']) || 0,
                score: parseInt(r['score']) || 0,
                bpm: parseFloat(r['bpm']) || 0,
                avgSpeed: parseFloat(r['avg speed']) || 0,
                timeSupersonic: parseFloat(r['time supersonic speed']) || 0,
                timeOnGround: parseFloat(r['time on ground']) || 0,
                timeLowAir: parseFloat(r['time low in air']) || 0,
                timeHighAir: parseFloat(r['time high in air']) || 0,
                timeDef: parseFloat(r['time defensive third']) || 0,
                timeNeutral: parseFloat(r['time neutral third']) || 0,
                timeOff: parseFloat(r['time offensive third']) || 0,
                demosInflicted: parseInt(r['demos inflicted']) || 0,
                demosTaken: parseInt(r['demos taken']) || 0,
                boostCollected: parseFloat(r['amount collected']) || 0,
                boostStolen: parseFloat(r['amount stolen']) || 0,
                zeroBoostTime: parseFloat(r['0 boost time']) || 0,
              })

       
            } else {
              theirGoals += goals
              if (!detectedOpponent) detectedOpponent = r['team name'] || r['player name']
            }
          })

          parsedGames.push({
            replayId,
            date: (playersInGame[0]['date'] || '').split(' ')[0],
            ourGoals,
            theirGoals,
          })
        })

        setGames(parsedGames)
        setPlayerStats(parsedStats)
        if (detectedOpponent) setImportOpponent(detectedOpponent)
        if (parsedGames[0]) setImportDate(parsedGames[0].date)
        setImportMessage(`Parsed ${parsedGames.length} game(s), ${parsedStats.length} of our player-stat rows matched.`)
      },
    })
  }

  async function handleImportConfirm() {
    setImportMessage('Saving to database...')

    const { data: team } = await supabase.from('teams').select('id').eq('name', importTeam).limit(1).single()
    const { data: comps } = await supabase.from('competitions').select('id').limit(1)
    if (!team) {
      setImportMessage('Team not found')
      return
    }

    const { data: series, error: seriesError } = await supabase
      .from('series')
      .insert({
        competition_id: comps?.[0]?.id,
        flop_reset_team_id: team.id,
        opponent_name: importOpponent,
        best_of: games.length,
        series_date: importDate,
        notes: `Imported via CSV — ${importOpponent}`,
      })
      .select()
      .single()

    if (!series) {
      setImportMessage(`Failed to create series: ${seriesError?.message}`)
      return
    }

    for (const game of games) {
      const { data: match } = await supabase
        .from('matches')
        .insert({
          competition_id: comps?.[0]?.id,
          flop_reset_team_id: team.id,
          series_id: series.series_id,
          opponent_name: importOpponent,
          flop_reset_score: game.ourGoals,
          opponent_score: game.theirGoals,
          match_date: game.date,
        })
        .select()
        .single()

      if (!match) continue

      const statsForGame = playerStats.filter((p) => p.replayId === game.replayId)
      for (const stat of statsForGame) {
        await supabase.from('match_player_stats').insert({
          match_id: match.match_id,
          player_id: stat.playerId,
          goals: stat.goals,
          assists: stat.assists,
          saves: stat.saves,
          shots: stat.shots,
          score: stat.score,
          bpm: stat.bpm,
          avg_speed: stat.avgSpeed,
          time_supersonic: stat.timeSupersonic,
          time_on_ground: stat.timeOnGround,
          time_low_air: stat.timeLowAir,
          time_high_air: stat.timeHighAir,
          time_defensive_third: stat.timeDef,
          time_neutral_third: stat.timeNeutral,
          time_offensive_third: stat.timeOff,
          demos_inflicted: stat.demosInflicted,
          demos_taken: stat.demosTaken,
          boost_collected: stat.boostCollected,
          boost_stolen: stat.boostStolen,
          zero_boost_time: stat.zeroBoostTime,
        })
      }
    }

    setImportMessage(`Imported ${games.length} game(s) successfully!`)
    setGames([])
    setPlayerStats([])
    loadManageData()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('Saving...')

    const { data: comp } = await supabase.from('competitions').select('id, format').eq('id', competitionId).single()
    const { data: team } = await supabase.from('teams').select('id').eq('name', teamName).eq('format', comp?.format).single()
    if (!team) {
      setMessage('Team not found for that format — check the Competition matches the team')
      return
    }

    const finalFlopScore = isForfeit ? (forfeitResult === 'win' ? 1 : 0) : parseInt(flopScore)
    const finalOpponentScore = isForfeit ? (forfeitResult === 'win' ? 0 : 1) : parseInt(opponentScore)

    const { data: series, error: seriesError } = await supabase
      .from('series')
      .insert({
        competition_id: competitionId,
        flop_reset_team_id: team.id,
        opponent_name: opponentName,
        best_of: 1,
        series_date: matchDate,
        notes: isForfeit ? `Forfeit — ${matchRound || ''}`.trim() : matchRound || null,
      })
      .select()
      .single()

    if (!series) {
      setMessage(`Failed to create series: ${seriesError?.message}`)
      return
    }

    const { error } = await supabase.from('matches').insert({
      competition_id: competitionId,
      flop_reset_team_id: team.id,
      series_id: series.series_id,
      opponent_name: opponentName,
      flop_reset_score: finalFlopScore,
      opponent_score: finalOpponentScore,
      is_forfeit: isForfeit,
      match_date: matchDate,
      round: matchRound,
    })

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Match saved!')
      setOpponentName('')
      setFlopScore('')
      setOpponentScore('')
      setMatchDate('')
      setIsForfeit(false)
      setMatchRound('')
      loadManageData()
    }
  }

  async function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setScheduleMessage('Saving...')

    const { data: comp } = await supabase.from('competitions').select('format').eq('id', scheduleCompetitionId).single()
    const { data: team } = await supabase.from('teams').select('id').eq('name', scheduleTeamName).eq('format', comp?.format).single()
    if (!team) {
      setScheduleMessage('Team not found for that format — check the Competition matches the team')
      return
    }

    const { error } = await supabase.from('scheduled_matches').insert({
      competition_id: scheduleCompetitionId,
      flop_reset_team_id: team.id,
      opponent_name: scheduleOpponent || null,
      match_date: scheduleDate,
      match_time: scheduleTime,
      notes: scheduleNotes,
      status: 'scheduled',
    })

    if (error) {
      setScheduleMessage(`Error: ${error.message}`)
    } else {
      setScheduleMessage('Scheduled match added!')
      setScheduleOpponent('')
      setScheduleDate('')
      setScheduleTime('')
      setScheduleNotes('')
      loadScheduled()
    }
  }

  async function deleteScheduled(id: number) {
    if (!confirm('Delete this scheduled match?')) return
    await supabase.from('scheduled_matches').delete().eq('scheduled_id', id)
    loadScheduled()
  }

  async function markCompleted(id: number) {
    await supabase.from('scheduled_matches').update({ status: 'completed' }).eq('scheduled_id', id)
    loadScheduled()
  }

  function handlePrParse() {
    try {
      const parsed = parseLeagueMatches(prText)
      setPrPreview(parsed)
      setPrMessage(`Parsed ${parsed.length} matches.`)
    } catch (err: any) {
      setPrMessage(`Parse error: ${err.message}`)
    }
  }

  async function handlePrConfirm() {
    setPrMessage('Saving...')
    const label = new Date().toISOString().split('T')[0]
    const rows = prPreview.map((m) => ({ ...m, format: prFormat, batch_label: label }))
    const { error } = await supabase.from('league_matches').insert(rows)
    if (error) {
      setPrMessage(`Error: ${error.message}`)
    } else {
      setPrMessage(`Imported ${rows.length} matches!`)
      setPrPreview([])
      setPrText('')
      loadManageData()
    }
  }

  async function deleteSeries(seriesId: number) {
    if (!confirm('Delete this series and all its games/stats? This cannot be undone.')) return

    const { data: matchRows, error: fetchErr } = await supabase.from('matches').select('match_id').eq('series_id', seriesId)
    if (fetchErr) { alert(`Failed to look up matches: ${fetchErr.message}`); return }

    const matchIds = matchRows?.map((m) => m.match_id) ?? []
    if (matchIds.length) {
      const { error: statsErr } = await supabase.from('match_player_stats').delete().in('match_id', matchIds)
      if (statsErr) { alert(`Failed to delete stats: ${statsErr.message}`); return }
    }

    const { error: matchErr } = await supabase.from('matches').delete().eq('series_id', seriesId)
    if (matchErr) { alert(`Failed to delete matches: ${matchErr.message}`); return }

    const { error: seriesErr } = await supabase.from('series').delete().eq('series_id', seriesId)
    if (seriesErr) { alert(`Failed to delete series: ${seriesErr.message}`); return }

    loadManageData()
  }

  async function deleteBatch(batchLabel: string, format: string) {
    if (!confirm(`Delete all ${format} matches from batch "${batchLabel}"? This cannot be undone.`)) return

    const query = supabase.from('league_matches').delete().eq('format', format)
    const { error } = batchLabel
      ? await query.eq('batch_label', batchLabel)
      : await query.is('batch_label', null)

    if (error) { alert(`Failed to delete batch: ${error.message}`); return }
    loadManageData()
  }

  const tabClass = (t: string) =>
    `px-4 py-2 rounded-t-lg font-semibold ${tab === t ? 'bg-neutral-900 text-white' : 'bg-neutral-950 text-neutral-500 hover:text-neutral-300'}`

  return (
    <main className="px-8 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin</h1>

      <div className="flex gap-1 border-b border-neutral-800 mb-8 flex-wrap">
        <button onClick={() => setTab('add')} className={tabClass('add')}>Add Result</button>
        <button onClick={() => setTab('import')} className={tabClass('import')}>Import CSV</button>
        <button onClick={() => setTab('schedule')} className={tabClass('schedule')}>Schedule</button>
        <button onClick={() => setTab('rankings')} className={tabClass('rankings')}>Power Rankings</button>
        <button onClick={() => setTab('manage')} className={tabClass('manage')}>Manage</button>
      </div>

      {tab === 'add' && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label>
            Competition:
            <select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)}>
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            Team:
            <select value={teamName} onChange={(e) => setTeamName(e.target.value)}>
              <option value="Frameshift">Frameshift</option>
              <option value="Frantic">Frantic</option>
              <option value="Fracture">Fracture</option>
            </select>
          </label>
          <label>
            Opponent:
            <input value={opponentName} onChange={(e) => setOpponentName(e.target.value)} required />
          </label>
          <label>
            <input type="checkbox" checked={isForfeit} onChange={(e) => setIsForfeit(e.target.checked)} />
            {' '}This was a forfeit
          </label>
          {isForfeit ? (
            <label>
              Result:
              <select value={forfeitResult} onChange={(e) => setForfeitResult(e.target.value)}>
                <option value="win">Win (opponent forfeited)</option>
                <option value="loss">Loss (we forfeited)</option>
              </select>
            </label>
          ) : (
            <>
              <label>
                Your Score:
                <input type="number" value={flopScore} onChange={(e) => setFlopScore(e.target.value)} required />
              </label>
              <label>
                Opponent Score:
                <input type="number" value={opponentScore} onChange={(e) => setOpponentScore(e.target.value)} required />
              </label>
            </>
          )}
          <label>
            Date:
            <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} required />
          </label>
          <label>
            Round (optional):
            <input value={matchRound} onChange={(e) => setMatchRound(e.target.value)} placeholder="e.g. Week 2, Round 1, Playoffs" />
          </label>
          <button type="submit" className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded w-fit">
            Save Match
          </button>
          {message && <p>{message}</p>}
        </form>
      )}

      {tab === 'import' && (
        <div>
          <label className="block mb-4">
            Team:
            <select
              value={importTeam}
              onChange={(e) => handleImportTeamChange(e.target.value)}
              className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2"
            >
              <option value="Frameshift">Frameshift</option>
              <option value="Frantic">Frantic</option>
              <option value="Fracture">Fracture</option>
            </select>
          </label>

          <label className="block mb-6">
            Players CSV (the "...-players.csv" or "...-players-games.csv" export):
            <input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && handlePlayersFile(e.target.files[0])}
              className="block mt-1"
            />
          </label>

          {importMessage && <p className="text-neutral-300 mb-4">{importMessage}</p>}

          {games.length > 0 && (
            <div>
              <label className="block mb-2">
                Opponent:
                <input
                  value={importOpponent}
                  onChange={(e) => setImportOpponent(e.target.value)}
                  className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
                />
              </label>

              <h2 className="text-xl font-semibold mt-4 mb-2">Games ({games.length})</h2>
              {games.map((g) => (
                <div key={g.replayId} className="text-sm text-neutral-300 mb-1">
                  {g.date} — {g.ourGoals}-{g.theirGoals}
                </div>
              ))}

              <h2 className="text-xl font-semibold mt-4 mb-2">Player Stats ({playerStats.length} rows)</h2>
              {playerStats.map((p, i) => (
                <div key={i} className="text-sm text-neutral-400">
                  {p.playerName}: {p.goals}G {p.assists}A {p.saves}S
                </div>
              ))}

              <button
                onClick={handleImportConfirm}
                className="mt-6 bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded"
              >
                Confirm Import
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'schedule' && (
        <div>
          <form onSubmit={handleScheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label>
              Competition:
              <select value={scheduleCompetitionId} onChange={(e) => setScheduleCompetitionId(e.target.value)}>
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label>
              Team:
              <select value={scheduleTeamName} onChange={(e) => setScheduleTeamName(e.target.value)}>
                <option value="Frameshift">Frameshift</option>
                <option value="Frantic">Frantic</option>
                <option value="Fracture">Fracture</option>
              </select>
            </label>
            <label>
              Opponent (optional):
              <input value={scheduleOpponent} onChange={(e) => setScheduleOpponent(e.target.value)} placeholder="TBD if unknown" />
            </label>
            <label>
              Date:
              <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} required />
            </label>
            <label>
              Time:
              <input value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} placeholder="8:00 PM" />
            </label>
            <label>
              Notes:
              <input value={scheduleNotes} onChange={(e) => setScheduleNotes(e.target.value)} />
            </label>
            <button type="submit" className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded w-fit">
              Add to Schedule
            </button>
            {scheduleMessage && <p>{scheduleMessage}</p>}
          </form>

          <div className="mt-8 space-y-2">
            <h2 className="text-xl font-semibold">Current Schedule</h2>
            {scheduledList.length === 0 && <p className="text-neutral-500">Nothing scheduled.</p>}
            {scheduledList.map((s) => (
              <div key={s.scheduled_id} className="flex items-center justify-between border border-neutral-800 rounded p-3">
                <span>
                  {(s.teams as any)?.name} vs {s.opponent_name ?? 'TBD'} — {s.match_date} {s.match_time} ({s.status})
                </span>
                <span className="flex gap-2">
                  {s.status === 'scheduled' && (
                    <button type="button" onClick={() => markCompleted(s.scheduled_id)} className="text-sm text-green-400">
                      Mark Completed
                    </button>
                  )}
                  <button type="button" onClick={() => deleteScheduled(s.scheduled_id)} className="text-sm text-red-400">
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'rankings' && (
        <div>
          <label className="block mb-4">
            Format:
            <select value={prFormat} onChange={(e) => setPrFormat(e.target.value)} className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2">
              <option value="3v3">3v3</option>
              <option value="2v2">2v2</option>
            </select>
          </label>
          <label className="block mb-4">
            Paste the full match list from The Rivalry:
            <textarea
              value={prText}
              onChange={(e) => setPrText(e.target.value)}
              rows={10}
              className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full font-mono text-xs"
            />
          </label>
          <button onClick={handlePrParse} className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded mb-4">
            Parse
          </button>
          {prMessage && <p className="text-neutral-300 mb-4">{prMessage}</p>}
          {prPreview.length > 0 && (
            <div>
              <div className="max-h-64 overflow-y-auto text-xs text-neutral-400 space-y-1 mb-4">
                {prPreview.slice(0, 20).map((m, i) => (
                  <div key={i}>{m.round} / {m.tier}: {m.team_a} vs {m.team_b ?? '(bye)'} — {m.status} {m.score_a && `(${m.score_a}-${m.score_b})`}</div>
                ))}
                {prPreview.length > 20 && <div>...and {prPreview.length - 20} more</div>}
              </div>
              <button onClick={handlePrConfirm} className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded">
                Confirm Import
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'manage' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Match Results (Series)</h2>
          <div className="space-y-2 mb-10">
            {manageSeries.length === 0 && <p className="text-neutral-500">No series recorded yet.</p>}
            {manageSeries.map((s) => (
              <div key={s.series_id} className="flex items-center justify-between border border-neutral-800 rounded p-3">
                <span>
                  {(s.teams as any)?.name} ({(s.teams as any)?.format}) vs {s.opponent_name} — {s.series_date}
                </span>
                <button onClick={() => deleteSeries(s.series_id)} className="text-sm text-red-400">
                  Delete
                </button>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-bold mb-4 mt-10">Assign MVP</h2>
          <div className="flex gap-2 mb-4">
            <input
              placeholder="Match ID"
              value={mvpMatchId}
              onChange={(e) => setMvpMatchId(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
            />
            <button onClick={() => loadMvpCandidates(mvpMatchId)} className="bg-purple-700 px-4 py-2 rounded text-sm">
              Load Players
            </button>
          </div>
          {mvpCandidates.map((c) => (
            <div key={c.stat_id} className="flex items-center justify-between border border-neutral-800 rounded p-3 mb-2">
              <span>{c.players?.name} {c.mvp && <span className="text-purple-400 ml-2">★ Current MVP</span>}</span>
              <button onClick={() => setMvp(c.stat_id, mvpMatchId)} className="text-sm text-purple-400">
                Set MVP
              </button>
            </div>
          ))}

          <h2 className="text-xl font-bold mb-4">Power Rankings Imports</h2>
          <div className="space-y-2">
            {manageBatches.length === 0 && <p className="text-neutral-500">No Power Rankings data imported yet.</p>}
            {manageBatches.map((b) => (
              <div key={`${b.batch_label}-${b.format}`} className="flex items-center justify-between border border-neutral-800 rounded p-3">
                <span>{b.format} — {b.batch_label} ({b.count} matches)</span>
                <button onClick={() => deleteBatch(b.batch_label, b.format)} className="text-sm text-red-400">
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}