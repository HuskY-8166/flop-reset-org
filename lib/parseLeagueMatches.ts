export function parseLeagueMatches(text: string) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const matches: any[] = []
  let i = 0

  while (i < lines.length) {
    const round = lines[i]; i++
    const tier = lines[i]; i++
    i++ // skip teamA badge line
    const teamA = lines[i]; i++
    const token = lines[i]

    if (token === 'BYE') {
      i += 4 // BYE, —, No Opponent, Bye
      const date = lines[i]; i++
      matches.push({ round, tier, team_a: teamA, team_b: null, score_a: null, score_b: null, status: 'bye', match_date: date })
    } else if (token === 'VS') {
      i++
      i++ // teamB badge
      const teamB = lines[i]; i++
      i++ // status label (Scheduled)
      const date = lines[i]; i++
      matches.push({ round, tier, team_a: teamA, team_b: teamB, score_a: null, score_b: null, status: 'scheduled', match_date: date })
    } else {
      const next = lines[i + 1]
      if (next === '–' || next === '-') {
        const scoreA = token; i++
        i++ // dash
        const scoreB = lines[i]; i++
        i++ // teamB badge
        const teamB = lines[i]; i++
        i++ // 'Completed'
        const date = lines[i]; i++
        matches.push({ round, tier, team_a: teamA, team_b: teamB, score_a: scoreA, score_b: scoreB, status: 'completed', match_date: date })
      } else {
        const teamB = next; i += 2
        i++ // 'Cancelled'
        const date = lines[i]; i++
        matches.push({ round, tier, team_a: teamA, team_b: teamB, score_a: null, score_b: null, status: 'cancelled', match_date: date })
      }
    }
  }

  return matches
}