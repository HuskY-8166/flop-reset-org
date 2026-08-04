'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase'

type Game = { replayId: string; date: string; ourGoals: number; theirGoals: number }
type PlayerStat = { replayId: string; rawName: string; playerId: number | null; playerName: string; goals: number; assists: number; saves: number; shots: number; score: number }

export default function ImportCSV() {
  const [teamName, setTeamName] = useState('Frameshift')
  const [opponentName, setOpponentName] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([])
  const [rosterPlayers, setRosterPlayers] = useState<{ player_id: number; name: string }[]>([])
  const [message, setMessage] = useState('')

  async function loadRoster(team: string) {
    const { data: teamRow } = await supabase.from('teams').select('id').eq('name', team).limit(1).single()
    if (!teamRow) return
    const { data: players } = await supabase.from('players').select('player_id, name').eq('team_id', teamRow.id)
    setRosterPlayers(players ?? [])
  }

  function handleTeamChange(team: string) {
    setTeamName(team)
    loadRoster(team)
  }

  function findMatchingPlayerId(rawName: string, roster: { player_id: number; name: string }[]) {
    const lower = rawName.toLowerCase()
    const exact = roster.find((p) => p.name.toLowerCase() === lower)
    if (exact) return exact
    const partial = roster.find((p) => lower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(lower))
    return partial ?? null
  }

  function handleTeamsFile(file: File) {
    Papa.parse(file, {
      header: true,
      delimiter: ';',
      complete: (results: any) => {
        const rows = results.data as any[]
        const byReplay: Record<string, any[]> = {}
        rows.forEach((r) => {
          if (!r['replay id']) return
          byReplay[r['replay id']] = byReplay[r['replay id']] || []
          byReplay[r['replay id']].push(r)
        })

        const parsedGames: Game[] = []
        let detectedOpponent = ''

        Object.entries(byReplay).forEach(([replayId, pair]) => {
          const ourRow = pair.find((r) => {
            const namesInTeam = (r['team name'] || '').split('&').map((s: string) => s.trim().toLowerCase())
            return namesInTeam.some((n: string) =>
              rosterPlayers.some((p) => n.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(n))
            )
          })
          const theirRow = pair.find((r) => r !== ourRow)
          if (!ourRow || !theirRow) return

          if (!detectedOpponent) detectedOpponent = theirRow['team name'] || ''

          parsedGames.push({
            replayId,
            date: (ourRow['date'] || '').split(' ')[0],
            ourGoals: parseInt(ourRow['goals']) || 0,
            theirGoals: parseInt(ourRow['goals conceded']) || 0,
          })
        })

        setGames(parsedGames)
        if (detectedOpponent) setOpponentName(detectedOpponent)
        if (parsedGames[0]) setMatchDate(parsedGames[0].date)
        setMessage(`Parsed ${parsedGames.length} game(s).`)
      },
    })
  }

  function handlePlayersFile(file: File) {
    Papa.parse(file, {
      header: true,
      delimiter: ';',
      complete: (results: any) => {
        const rows = results.data as any[]
        const parsed: PlayerStat[] = []

        rows.forEach((r) => {
          if (!r['replay id'] || !r['player name']) return
          const match = findMatchingPlayerId(r['player name'], rosterPlayers)
          parsed.push({
            replayId: r['replay id'],
            rawName: r['player name'],
            playerId: match?.player_id ?? null,
            playerName: match?.name ?? r['player name'],
            goals: parseInt(r['goals']) || 0,
            assists: parseInt(r['assists']) || 0,
            saves: parseInt(r['saves']) || 0,
            shots: parseInt(r['shots']) || 0,
            score: parseInt(r['score']) || 0,
          })
        })

        // Keep only rows that matched a roster player (this filters out the opponent's stat lines)
        setPlayerStats(parsed.filter((p) => p.playerId !== null))
        setMessage((m) => m + ` Matched ${parsed.filter((p) => p.playerId !== null).length} player-stat rows.`)
      },
    })
  }

  async function handleConfirm() {
    setMessage('Saving to database...')

    const { data: team } = await supabase.from('teams').select('id').eq('name', teamName).limit(1).single()
    const { data: competitions } = await supabase.from('competitions').select('id').limit(1)
    if (!team) {
      setMessage('Team not found')
      return
    }

    const { data: series } = await supabase
      .from('series')
      .insert({
        competition_id: competitions?.[0]?.id,
        flop_reset_team_id: team.id,
        opponent_name: opponentName,
        best_of: games.length,
        series_date: matchDate,
        notes: `Imported via CSV — ${opponentName}`,
      })
      .select()
      .single()

    if (!series) {
      setMessage('Failed to create series')
      return
    }

    for (const game of games) {
      const { data: match } = await supabase
        .from('matches')
        .insert({
          competition_id: competitions?.[0]?.id,
          flop_reset_team_id: team.id,
          series_id: series.series_id,
          opponent_name: opponentName,
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
        })
      }
    }

    setMessage(`Imported ${games.length} game(s) successfully!`)
    setGames([])
    setPlayerStats([])
  }

  return (
    <main className="px-8 py-12 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Import from CSV</h1>

      <label className="block mb-4">
        Team:
        <select
          value={teamName}
          onChange={(e) => handleTeamChange(e.target.value)}
          className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2"
        >
          <option value="Frameshift">Frameshift</option>
          <option value="Frantic">Frantic</option>
          <option value="Fracture">Fracture</option>
        </select>
      </label>

      <label className="block mb-4">
        Teams-Games CSV (e.g. "...-teams-games.csv"):
        <input
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && handleTeamsFile(e.target.files[0])}
          className="block mt-1"
        />
      </label>

      <label className="block mb-6">
        Players-Games CSV (e.g. "...-players-games.csv"):
        <input
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && handlePlayersFile(e.target.files[0])}
          className="block mt-1"
        />
      </label>

      {message && <p className="text-neutral-300 mb-6">{message}</p>}

      {games.length > 0 && (
        <div className="mb-6">
          <label className="block mb-2">
            Opponent:
            <input
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              className="block mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 w-full"
            />
          </label>

          <h2 className="text-xl font-semibold mt-4 mb-2">Games ({games.length})</h2>
          {games.map((g) => (
            <div key={g.replayId} className="text-sm text-neutral-300 mb-1">
              {g.date} — {g.ourGoals}-{g.theirGoals}
            </div>
          ))}

          <h2 className="text-xl font-semibold mt-4 mb-2">Player Stats ({playerStats.length} rows matched)</h2>
          {playerStats.map((p, i) => (
            <div key={i} className="text-sm text-neutral-400">
              {p.playerName}: {p.goals}G {p.assists}A {p.saves}S
            </div>
          ))}

          <button
            onClick={handleConfirm}
            className="mt-6 bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded"
          >
            Confirm Import
          </button>
        </div>
      )}
    </main>
  )
}