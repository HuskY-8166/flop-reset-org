export const RATING_MODEL_VERSION = 'FR-ELO-1.0'

export type LeagueMatch = {
  id?: number | string | null
  competition_id?: number | string | null
  format?: string | null
  round: string
  tier: string
  team_a: string
  team_b: string | null
  score_a: string | null
  score_b: string | null
  status: string
  match_date: string
  batch_label?: string | null
}

export type RatingMatchEvent = {
  matchKey: string
  round: number
  roundLabel: string
  date: string
  team: string
  opponent: string
  tier: string
  result: 'W' | 'L'
  displayScore: string
  isForfeit: boolean
  ratingBefore: number
  ratingAfter: number
  delta: number
  opponentRatingBefore: number
  expectedWinProbability: number
  surprise: number
}

export type RatingRoundPoint = {
  round: number
  roundLabel: string
  date: string
  rating: number
  delta: number
  opponents: string[]
  results: string[]
}

export function ratingPoolKey(competitionId: number | string | null | undefined, format: string | null | undefined) {
  return `${competitionId ?? 'legacy-unscoped'}|${format ?? 'format-unrecorded'}`
}

function assertSingleRatingPool(matches: LeagueMatch[]) {
  const formats = new Set(matches.map((match) => match.format).filter(Boolean))
  const competitions = new Set(matches.map((match) => match.competition_id).filter((value) => value !== null && value !== undefined))
  if (formats.size > 1) throw new Error('The rating engine received multiple formats. Calculate each rating pool separately.')
  if (competitions.size > 1) throw new Error('The rating engine received multiple competitions. Calculate each rating pool separately.')
}

const TIER_SEED: Record<string, number> = {
  'Tier 1': 1900,
  'Tier 3': 1575,
  'Tier 4': 1425,
  'Tier 5': 1275,
  'Tier 6': 1125,
  'Tier 7': 975,
}

function kForMatchCount(count: number) {
  const sequence = [48, 40, 32, 28, 24]
  return count <= sequence.length ? sequence[count - 1] : 24
}

function roundNumber(value: string) {
  return Number.parseInt(value.replace(/\D/g, ''), 10) || 0
}

function scoreNumber(value: string | null) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function isForfeit(match: LeagueMatch) {
  return match.score_a === 'FFW' || match.score_a === 'FFL'
}

function ratingExpectation(rating: number, opponentRating: number) {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400))
}

function competitionRank<T>(rows: T[], value: (row: T) => number) {
  let rank = 0
  let previous: number | null = null
  return [...rows].sort((a, b) => value(b) - value(a)).map((row, index) => {
    const current = value(row)
    if (previous === null || current !== previous) rank = index + 1
    previous = current
    return { row, rank }
  })
}

function matchIdentity(match: LeagueMatch, index: number) {
  if (match.id !== null && match.id !== undefined) return `id:${match.id}`
  return [match.competition_id ?? 'legacy', match.format ?? '', match.tier, match.round, match.match_date, match.team_a, match.team_b, match.score_a, match.score_b].join('|') || `row:${index}`
}

export function dedupeLeagueMatches(matches: LeagueMatch[]) {
  const seen = new Set<string>()
  return matches.filter((match, index) => {
    const key = matchIdentity(match, index)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function calculateElo(matches: LeagueMatch[]) {
  const { teamSummaries } = calculateEloWithHistory(matches)
  return teamSummaries.map((team) => ({
    team: team.team,
    tier: team.tier,
    rating: team.rating,
    matches: team.matchesTracked,
  }))
}

export function calculateEloWithHistory(inputMatches: LeagueMatch[]) {
  assertSingleRatingPool(inputMatches)
  const uniqueMatches = dedupeLeagueMatches(inputMatches)
  const completed = uniqueMatches
    .map((match, inputOrder) => ({ ...match, inputOrder, roundNum: roundNumber(match.round) }))
    .filter((match) => match.status === 'completed' && match.team_b && match.score_a !== null && match.score_b !== null)
    .sort((a, b) => a.roundNum - b.roundNum || String(a.match_date).localeCompare(String(b.match_date)) || a.inputOrder - b.inputOrder)

  const ratings: Record<string, number> = {}
  const tierOf: Record<string, string> = {}
  const matchCounts: Record<string, number> = {}
  const matchHistory: Record<string, RatingMatchEvent[]> = {}
  const giantKiller: Record<string, { upsets: number; largestGap: number; cumulativeGap: number }> = {}

  function getRating(team: string, tier: string) {
    if (!(team in ratings)) {
      ratings[team] = TIER_SEED[tier] ?? 1500
      tierOf[team] = tier
      matchHistory[team] = []
      giantKiller[team] = { upsets: 0, largestGap: 0, cumulativeGap: 0 }
    }
    return ratings[team]
  }

  const tierRoundMargins: Record<string, number[]> = {}
  completed.forEach((match) => {
    if (isForfeit(match)) return
    const key = `${match.tier}|${match.round}`
    const margin = Math.abs(scoreNumber(match.score_a) - scoreNumber(match.score_b))
    tierRoundMargins[key] = [...(tierRoundMargins[key] ?? []), margin]
  })
  const averageMargin = Object.fromEntries(Object.entries(tierRoundMargins).map(([key, margins]) => [key, margins.reduce((sum, value) => sum + value, 0) / margins.length]))

  const rounds = [...new Set(completed.map((match) => match.roundNum))].sort((a, b) => a - b)
  const roundSnapshots: Record<number, { team: string; tier: string; rating: number; overallRank: number; tierRank: number }[]> = {}

  for (const round of rounds) {
    const roundMatches = completed.filter((match) => match.roundNum === round)

    for (const match of roundMatches) {
      const teamA = match.team_a
      const teamB = match.team_b!
      const ratingA = getRating(teamA, match.tier)
      const ratingB = getRating(teamB, match.tier)
      const forfeit = isForfeit(match)
      const scoreA = forfeit ? match.score_a === 'FFW' ? 1 : 0 : scoreNumber(match.score_a)
      const scoreB = forfeit ? match.score_a === 'FFW' ? 0 : 1 : scoreNumber(match.score_b)
      const actualA = scoreA > scoreB ? 1 : 0
      const expectationA = ratingExpectation(ratingA, ratingB)
      const expectationB = 1 - expectationA

      let marginMultiplier = 1
      if (!forfeit) {
        const margin = Math.abs(scoreA - scoreB)
        const contextualAverage = averageMargin[`${match.tier}|${match.round}`] || 1
        marginMultiplier = Math.min(1.5, margin / contextualAverage)
      }

      const countA = (matchCounts[teamA] ?? 0) + 1
      const countB = (matchCounts[teamB] ?? 0) + 1
      let kA = kForMatchCount(countA)
      let kB = kForMatchCount(countB)
      if (forfeit) {
        kA /= 2
        kB /= 2
      }

      const deltaA = kA * marginMultiplier * (actualA - expectationA)
      const deltaB = kB * marginMultiplier * ((1 - actualA) - expectationB)
      ratings[teamA] = ratingA + deltaA
      ratings[teamB] = ratingB + deltaB
      matchCounts[teamA] = countA
      matchCounts[teamB] = countB

      const key = matchIdentity(match, match.inputOrder)
      const score = forfeit ? `${actualA ? 'W' : 'L'} · FORFEIT · 0–0` : `${scoreA}–${scoreB}`
      matchHistory[teamA].push({
        matchKey: key,
        round,
        roundLabel: match.round,
        date: match.match_date,
        team: teamA,
        opponent: teamB,
        tier: match.tier,
        result: actualA ? 'W' : 'L',
        displayScore: score,
        isForfeit: forfeit,
        ratingBefore: ratingA,
        ratingAfter: ratings[teamA],
        delta: deltaA,
        opponentRatingBefore: ratingB,
        expectedWinProbability: expectationA,
        surprise: actualA - expectationA,
      })
      matchHistory[teamB].push({
        matchKey: key,
        round,
        roundLabel: match.round,
        date: match.match_date,
        team: teamB,
        opponent: teamA,
        tier: match.tier,
        result: actualA ? 'L' : 'W',
        displayScore: forfeit ? `${actualA ? 'L' : 'W'} · FORFEIT · 0–0` : `${scoreB}–${scoreA}`,
        isForfeit: forfeit,
        ratingBefore: ratingB,
        ratingAfter: ratings[teamB],
        delta: deltaB,
        opponentRatingBefore: ratingA,
        expectedWinProbability: expectationB,
        surprise: (1 - actualA) - expectationB,
      })

      if (!forfeit && actualA === 1 && ratingA < ratingB) {
        const gap = ratingB - ratingA
        giantKiller[teamA].upsets += 1
        giantKiller[teamA].largestGap = Math.max(giantKiller[teamA].largestGap, gap)
        giantKiller[teamA].cumulativeGap += gap
      }
      if (!forfeit && actualA === 0 && ratingB < ratingA) {
        const gap = ratingA - ratingB
        giantKiller[teamB].upsets += 1
        giantKiller[teamB].largestGap = Math.max(giantKiller[teamB].largestGap, gap)
        giantKiller[teamB].cumulativeGap += gap
      }
    }

    const snapshot = Object.keys(ratings).map((team) => ({ team, tier: tierOf[team], rating: ratings[team], overallRank: 0, tierRank: 0 }))
    snapshot.sort((a, b) => b.rating - a.rating).forEach((entry, index) => { entry.overallRank = index + 1 })
    const byTier: Record<string, typeof snapshot> = {}
    snapshot.forEach((entry) => { byTier[entry.tier] = [...(byTier[entry.tier] ?? []), entry] })
    Object.values(byTier).forEach((entries) => entries.sort((a, b) => b.rating - a.rating).forEach((entry, index) => { entry.tierRank = index + 1 }))
    roundSnapshots[round] = snapshot
  }

  const teamRoundHistory: Record<string, RatingRoundPoint[]> = {}
  for (const [team, events] of Object.entries(matchHistory)) {
    const byRound = new Map<number, RatingMatchEvent[]>()
    events.forEach((event) => byRound.set(event.round, [...(byRound.get(event.round) ?? []), event]))
    teamRoundHistory[team] = [...byRound.entries()].sort(([a], [b]) => a - b).map(([round, roundEvents]) => ({
      round,
      roundLabel: roundEvents[0].roundLabel,
      date: [...roundEvents].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.date ?? '',
      rating: roundEvents.at(-1)!.ratingAfter,
      delta: roundEvents.reduce((sum, event) => sum + event.delta, 0),
      opponents: roundEvents.map((event) => event.opponent),
      results: roundEvents.map((event) => `${event.result} ${event.displayScore}`),
    }))
  }

  const latestRound = rounds.at(-1)
  const previousRound = rounds.at(-2)
  const teamSummaries = Object.keys(ratings).map((team) => {
    const events = matchHistory[team]
    const roundHistory = teamRoundHistory[team]
    const currentSnapshot = latestRound !== undefined ? roundSnapshots[latestRound]?.find((entry) => entry.team === team) : undefined
    const previousSnapshot = previousRound !== undefined ? roundSnapshots[previousRound]?.find((entry) => entry.team === team) : undefined
    const rankMove = previousSnapshot && currentSnapshot ? previousSnapshot.overallRank - currentSnapshot.overallRank : 0
    const roundDelta = (count: number) => roundHistory.slice(-count).reduce((sum, point) => sum + point.delta, 0)
    const recent = events.slice(-5)
    const performanceEvents = events.filter((event) => !event.isForfeit)
    const recentPerformance = performanceEvents.slice(-5)
    const sos = (sample: RatingMatchEvent[]) => sample.length ? sample.reduce((sum, event) => sum + event.opponentRatingBefore, 0) / sample.length : 0
    const adjustedForm = recentPerformance.length ? recentPerformance.reduce((sum, event) => sum + event.surprise, 0) / recentPerformance.length : 0
    const wins = performanceEvents.filter((event) => event.result === 'W')
    const losses = performanceEvents.filter((event) => event.result === 'L')
    const bestWin = [...wins].sort((a, b) => b.surprise - a.surprise)[0] ?? null
    const worstLoss = [...losses].sort((a, b) => a.surprise - b.surprise)[0] ?? null
    const ratingsOnly = [TIER_SEED[tierOf[team]] ?? 1500, ...events.map((event) => event.ratingAfter)]
    const confidence = events.length >= 10 ? 'Established' : events.length >= 4 ? 'Developing' : 'Provisional'
    const currentRoundEvents = latestRound === undefined ? [] : events.filter((event) => event.round === latestRound && !event.isForfeit)
    const roundQuality = currentRoundEvents.reduce((sum, event) => sum + event.surprise, 0)

    return {
      team,
      tier: tierOf[team],
      rating: ratings[team],
      overallRank: currentSnapshot?.overallRank ?? null,
      tierRank: currentSnapshot?.tierRank ?? null,
      rankMove,
      lastRoundDelta: roundDelta(1),
      threeRoundDelta: roundDelta(3),
      fiveRoundDelta: roundDelta(5),
      fullCircuitDelta: ratings[team] - (TIER_SEED[tierOf[team]] ?? 1500),
      peak: Math.max(...ratingsOnly),
      worst: Math.min(...ratingsOnly),
      matchesTracked: events.length,
      bestMatch: events.length ? Math.max(...events.map((event) => event.delta)) : 0,
      worstMatch: events.length ? Math.min(...events.map((event) => event.delta)) : 0,
      recentForm: recent.map((event) => event.result),
      adjustedForm,
      sosFull: sos(performanceEvents),
      sosRecent5: sos(recentPerformance),
      bestWin,
      worstLoss,
      confidence,
      teamOfRoundScore: roundDelta(1) + 2 * rankMove + 10 * roundQuality,
      giantKillerScore: giantKiller[team].cumulativeGap,
      giantKillerUpsets: giantKiller[team].upsets,
      giantKillerLargestGap: giantKiller[team].largestGap,
    }
  })

  const byTier = new Map<string, typeof teamSummaries>()
  teamSummaries.forEach((team) => byTier.set(team.tier, [...(byTier.get(team.tier) ?? []), team]))
  for (const teams of byTier.values()) {
    for (const { row, rank } of competitionRank(teams, (team) => team.sosFull)) Object.assign(row, { sosRank: rank, sosTierSize: teams.length })
  }

  return {
    modelVersion: RATING_MODEL_VERSION,
    uniqueMatchCount: uniqueMatches.length,
    duplicateCount: inputMatches.length - uniqueMatches.length,
    roundSnapshots,
    matchHistory,
    teamRoundHistory,
    teamSummaries: teamSummaries as Array<(typeof teamSummaries)[number] & { sosRank: number; sosTierSize: number }>,
    rounds,
    totalTeams: Object.keys(ratings).length,
  }
}
