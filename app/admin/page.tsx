'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Admin() {
  const [competitions, setCompetitions] = useState<any[]>([])
  const [competitionId, setCompetitionId] = useState('')
  const [teamName, setTeamName] = useState('Frameshift')
  const [opponentName, setOpponentName] = useState('')
  const [flopScore, setFlopScore] = useState('')
  const [opponentScore, setOpponentScore] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [isForfeit, setIsForfeit] = useState(false)
  const [forfeitResult, setForfeitResult] = useState('win')
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login')
    })

    supabase.from('competitions').select('id, name').then(({ data }) => {
      setCompetitions(data ?? [])
      if (data && data.length > 0) setCompetitionId(data[0].id)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('Saving...')

    const { data: team } = await supabase
      .from('teams')
      .select('id')
      .eq('name', teamName)
      .single()

    if (!team) {
      setMessage('Team not found')
      return
    }

    const finalFlopScore = isForfeit ? (forfeitResult === 'win' ? 1 : 0) : parseInt(flopScore)
    const finalOpponentScore = isForfeit ? (forfeitResult === 'win' ? 0 : 1) : parseInt(opponentScore)

    const { error } = await supabase.from('matches').insert({
      competition_id: competitionId,
      flop_reset_team_id: team.id,
      opponent_name: opponentName,
      flop_reset_score: finalFlopScore,
      opponent_score: finalOpponentScore,
      is_forfeit: isForfeit,
      match_date: matchDate,
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
    }
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '400px' }}>
      <h1>Add Match</h1>
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
        <button type="submit">Save Match</button>
      </form>
      {message && <p>{message}</p>}
    </main>
  )
}