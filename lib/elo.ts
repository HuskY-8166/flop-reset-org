export type LeagueMatch = {
  round: string
  tier: string
  team_a: string
  team_b: string | null
  score_a: string | null
  score_b: string | null
  status: string
  match_date: string
}

const TIER_SEED: Record<string, number> = {
  'Tier 1': 1900, 'Tier 3': 1575, 'Tier 4': 1425,
  'Tier 5': 1275, 'Tier 6': 1125, 'Tier 7': 975,
}

function kForMatchCount(n: number) {
  const seq = [48, 40, 32, 28, 24]
  return n <= seq.length ? seq[n - 1] : 24
}

export function calculateElo(matches: LeagueMatch[]) {
  const completed = matches
    .filter((m) => m.status === 'completed' && m.team_b && m.score_a != null && m.score_b != null)
    .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())

  const ratings: Record<string, number> = {}
  const tierOf: Record<string, string> = {}
  const matchCounts: Record<string, number> = {}

  function getRating(team: string, tier: string) {
    if (!(team in ratings)) {
      ratings[team] = TIER_SEED[tier] ?? 1500
      tierOf[team] = tier
    }
    return ratings[team]
  }

  const tierRoundDiffs: Record<string, number[]> = {}
  completed.forEach((m) => {
    if (m.score_a === 'FFW' || m.score_a === 'FFL') return
    const key = `${m.tier}|${m.round}`
    const diff = Math.abs(parseInt(m.score_a!) - parseInt(m.score_b!))
    tierRoundDiffs[key] = tierRoundDiffs[key] || []
    tierRoundDiffs[key].push(diff)
  })
  const tierRoundAvg: Record<string, number> = {}
  Object.entries(tierRoundDiffs).forEach(([k, v]) => {
    tierRoundAvg[k] = v.reduce((a, b) => a + b, 0) / v.length
  })

  completed.forEach((m) => {
    const a = m.team_a, b = m.team_b!, tier = m.tier
    const ra = getRating(a, tier)
    const rb = getRating(b, tier)

    const isForfeit = m.score_a === 'FFW' || m.score_a === 'FFL'
    let sA: number, movMult: number

    if (isForfeit) {
      sA = m.score_a === 'FFW' ? 1 : 0
      movMult = 1
    } else {
      const sa = parseInt(m.score_a!), sb = parseInt(m.score_b!)
      sA = sa > sb ? 1 : 0
      const diff = Math.abs(sa - sb)
      const avg = tierRoundAvg[`${tier}|${m.round}`] || 1
      movMult = Math.min(1.5, diff / avg)
    }

    const nA = (matchCounts[a] || 0) + 1
    const nB = (matchCounts[b] || 0) + 1
    let kA = kForMatchCount(nA)
    let kB = kForMatchCount(nB)
    if (isForfeit) { kA /= 2; kB /= 2 }

    const expA = 1 / (1 + Math.pow(10, (rb - ra) / 400))
    const expB = 1 - expA

    ratings[a] = ra + kA * movMult * (sA - expA)
    ratings[b] = rb + kB * movMult * ((1 - sA) - expB)
    matchCounts[a] = nA
    matchCounts[b] = nB
  })

  const allTeams = new Set<string>()
  matches.forEach((m) => {
    allTeams.add(m.team_a)
    if (m.team_b) allTeams.add(m.team_b)
    if (!tierOf[m.team_a]) tierOf[m.team_a] = m.tier
    if (m.team_b && !tierOf[m.team_b]) tierOf[m.team_b] = m.tier
  })

  return Array.from(allTeams).map((team) => ({
    team,
    tier: tierOf[team],
    rating: ratings[team] ?? null,
    matches: matchCounts[team] || 0,
  }))
}

export function calculateEloWithHistory(matches: LeagueMatch[]) {
  const completed = matches
    .filter((m) => m.status === 'completed' && m.team_b && m.score_a != null && m.score_b != null)
    .map((m) => ({ ...m, roundNum: parseInt(m.round.replace(/\D/g, '')) || 0 }))
    .sort((a, b) => a.roundNum - b.roundNum || new Date(a.match_date).getTime() - new Date(b.match_date).getTime())

  const ratings: Record<string, number> = {}
  const tierOf: Record<string, string> = {}
  const matchCounts: Record<string, number> = {}
  const history: Record<string, { round: number; rating: number; delta: number }[]> = {}
  const giantKillerPoints: Record<string, number> = {}

  function getRating(team: string, tier: string) {
    if (!(team in ratings)) {
      ratings[team] = TIER_SEED[tier] ?? 1500
      tierOf[team] = tier
      history[team] = [{ round: 0, rating: ratings[team], delta: 0 }]
    }
    return ratings[team]
  }

  const tierRoundDiffs: Record<string, number[]> = {}
  completed.forEach((m) => {
    if (m.score_a === 'FFW' || m.score_a === 'FFL') return
    const key = `${m.tier}|${m.round}`
    const diff = Math.abs(parseInt(m.score_a!) - parseInt(m.score_b!))
    tierRoundDiffs[key] = tierRoundDiffs[key] || []
    tierRoundDiffs[key].push(diff)
  })
  const tierRoundAvg: Record<string, number> = {}
  Object.entries(tierRoundDiffs).forEach(([k, v]) => {
    tierRoundAvg[k] = v.reduce((a, b) => a + b, 0) / v.length
  })

  const rounds = Array.from(new Set(completed.map((m) => m.roundNum))).sort((a, b) => a - b)
  const roundSnapshots: Record<number, { team: string; tier: string; rating: number; overallRank: number; tierRank: number }[]> = {}

  rounds.forEach((roundNum) => {
    const roundMatches = completed.filter((m) => m.roundNum === roundNum)

    roundMatches.forEach((m) => {
      const a = m.team_a, b = m.team_b!, tier = m.tier
      const ra = getRating(a, tier)
      const rb = getRating(b, tier)

      const isForfeit = m.score_a === 'FFW' || m.score_a === 'FFL'
      let sA: number, movMult: number

      if (isForfeit) {
        sA = m.score_a === 'FFW' ? 1 : 0
        movMult = 1
      } else {
        const sa = parseInt(m.score_a!), sb = parseInt(m.score_b!)
        sA = sa > sb ? 1 : 0
        const diff = Math.abs(sa - sb)
        const avg = tierRoundAvg[`${tier}|${m.round}`] || 1
        movMult = Math.min(1.5, diff / avg)
      }

      const nA = (matchCounts[a] || 0) + 1
      const nB = (matchCounts[b] || 0) + 1
      let kA = kForMatchCount(nA)
      let kB = kForMatchCount(nB)
      if (isForfeit) { kA /= 2; kB /= 2 }

      const expA = 1 / (1 + Math.pow(10, (rb - ra) / 400))
      const expB = 1 - expA

      const deltaA = kA * movMult * (sA - expA)
      const deltaB = kB * movMult * ((1 - sA) - expB)

      ratings[a] = ra + deltaA
      ratings[b] = rb + deltaB
      matchCounts[a] = nA
      matchCounts[b] = nB
      history[a].push({ round: roundNum, rating: ratings[a], delta: deltaA })
      history[b].push({ round: roundNum, rating: ratings[b], delta: deltaB })

      // Credit only a real upset, using the rating gap before this match. A
      // forfeit may affect Elo at half K but never creates a Giant Killer mark.
      if (!isForfeit && sA === 1 && ra < rb) giantKillerPoints[a] = (giantKillerPoints[a] ?? 0) + (rb - ra)
      if (!isForfeit && sA === 0 && rb < ra) giantKillerPoints[b] = (giantKillerPoints[b] ?? 0) + (ra - rb)
    })

    const snapshot = Object.keys(ratings).map((team) => ({
      team, tier: tierOf[team], rating: ratings[team], overallRank: 0, tierRank: 0,
    }))
    snapshot.sort((a, b) => b.rating - a.rating)
    snapshot.forEach((s, i) => { s.overallRank = i + 1 })

    const byTier: Record<string, typeof snapshot> = {}
    snapshot.forEach((s) => { byTier[s.tier] = byTier[s.tier] || []; byTier[s.tier].push(s) })
    Object.values(byTier).forEach((list) => {
      list.sort((a, b) => b.rating - a.rating)
      list.forEach((s, i) => { s.tierRank = i + 1 })
    })

    roundSnapshots[roundNum] = snapshot
  })

  const latestRound = rounds[rounds.length - 1]
  const prevRound = rounds[rounds.length - 2]
  const totalTeams = Object.keys(ratings).length

  const teamSummaries = Object.keys(ratings).map((team) => {
    const h = history[team]
    const ratingsOnly = h.map((x) => x.rating)
    const deltasOnly = h.filter((x) => x.round !== 0).map((x) => x.delta)
    const currentSnap = roundSnapshots[latestRound]?.find((s) => s.team === team)
    const prevSnap = prevRound !== undefined ? roundSnapshots[prevRound]?.find((s) => s.team === team) : undefined
    const rankMove = prevSnap && currentSnap ? prevSnap.overallRank - currentSnap.overallRank : 0
    const lastRoundDelta = h.filter((entry) => entry.round === latestRound).reduce((total, entry) => total + entry.delta, 0)

    return {
      team,
      tier: tierOf[team],
      rating: ratings[team],
      overallRank: currentSnap?.overallRank ?? null,
      tierRank: currentSnap?.tierRank ?? null,
      rankMove,
      lastRoundDelta,
      peak: Math.max(...ratingsOnly),
      worst: Math.min(...ratingsOnly),
      matchesTracked: matchCounts[team] || 0,
      bestMatch: deltasOnly.length ? Math.max(...deltasOnly) : 0,
      worstMatch: deltasOnly.length ? Math.min(...deltasOnly) : 0,
      teamOfRoundScore: 2 * rankMove + lastRoundDelta + 0.02 * ratings[team],
      giantKillerScore: giantKillerPoints[team] ?? 0,
    }
  })

  return { roundSnapshots, teamSummaries, rounds, totalTeams }
}
