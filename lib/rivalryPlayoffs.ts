export const RIVALRY_PLAYOFF_PARSER_VERSION = 'RIVALRY_PLAYOFF_BRACKET_V1'

export type RivalryPlayoffMatch = {
  tier: string
  roundName: string
  roundOrder: number
  matchOrder: number
  teamAName: string | null
  teamBName: string | null
  scoreA: number | null
  scoreB: number | null
  winnerSide: 1 | 2 | null
  isBye: boolean
  isForfeit: boolean
  isFinal: boolean
}

export type ExistingPlayoffMatch = {
  playoff_match_id: number
  bracket_id: number
  tier: string
  round_name: string
  round_order: number
  match_order: number
  team_a_name: string | null
  team_b_name: string | null
  competition_entry_a_id: number | null
  competition_entry_b_id: number | null
  score_a: number | null
  score_b: number | null
  winner_side: number | null
  status: string
  is_bye: boolean | null
  is_forfeit: boolean | null
}

export type PlayoffEntry = {
  entry_id: number
  tier: string | null
  display_name_snapshot: string
}

export type PlayoffSyncUpdate = {
  playoffMatchId: number
  expectedStatus: string
  expected: Pick<ExistingPlayoffMatch, 'team_a_name' | 'team_b_name' | 'competition_entry_a_id' | 'competition_entry_b_id' | 'score_a' | 'score_b' | 'winner_side' | 'is_bye' | 'is_forfeit'>
  patch: Record<string, unknown>
}

export function applyAtomicSyncPlanInMemory(existing: ExistingPlayoffMatch[], updates: PlayoffSyncUpdate[]) {
  const byId = new Map(existing.map((row) => [row.playoff_match_id, row]))
  for (const update of updates) {
    const current = byId.get(update.playoffMatchId)
    if (!current || current.status === 'final' || current.status !== update.expectedStatus) throw new Error('Playoff match changed during synchronization')
    for (const [key, value] of Object.entries(update.expected)) {
      if (current[key as keyof ExistingPlayoffMatch] !== value) throw new Error('Playoff match changed during synchronization')
    }
  }
  return existing.map((row) => {
    const update = updates.find((candidate) => candidate.playoffMatchId === row.playoff_match_id)
    return update ? { ...row, ...update.patch } : { ...row }
  })
}

function normalizeLeagueIdentity(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function decodeHtml(value: string) {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' }
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLocaleLowerCase('en-US')] ?? match)
}

function text(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function classValue(html: string, className: string) {
  const match = html.match(new RegExp(`<[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'))
  return match ? text(match[1]) : ''
}

function normalizedRound(value: string) {
  const round = normalizeLeagueIdentity(value)
  if (round === 'opening round') return { name: 'Opening Round', order: 1 }
  if (round === 'quarterfinal' || round === 'quarterfinals') return { name: 'Quarterfinal', order: 2 }
  if (round === 'semifinal' || round === 'semifinals') return { name: 'Semifinal', order: 3 }
  if (round === 'final' || round === 'finals') return { name: 'Final', order: 4 }
  if (round === '3rd place' || round === 'third place') return { name: '3rd Place', order: 4 }
  return null
}

function participantName(value: string, isBye: boolean) {
  const normalized = normalizeLeagueIdentity(value)
  if (!normalized || normalized === 'tbd' || normalized.startsWith('sf loser')) return null
  if (isBye && normalized === 'bye') return null
  return value.trim()
}

function parseMatchup(html: string, tier: string, roundName: string, roundOrder: number, matchOrder: number): RivalryPlayoffMatch | null {
  const openingTag = html.slice(0, html.indexOf('>') + 1)
  const matchupClass = openingTag.match(/class=["']([^"']+)["']/i)?.[1] ?? ''
  const isBye = /\brivalry-bracket-matchup-bye\b/i.test(matchupClass)
  const explicitForfeit = /\b(?:rivalry-bracket-matchup-)?forfeit(?:ed)?\b/i.test(matchupClass)
  const completed = /\brivalry-bracket-matchup-completed\b/i.test(matchupClass)
  const teamStarts = [...html.matchAll(/<div\s+class=["'][^"']*\brivalry-bracket-team\b[^"']*["'][^>]*>/gi)].slice(0, 2)
  const teamParts = teamStarts.map((start, index) => html.slice(start.index!, teamStarts[index + 1]?.index ?? html.length))
  if (teamParts.length !== 2) return null

  const rawA = classValue(teamParts[0], 'rivalry-bracket-team-name')
  const rawB = classValue(teamParts[1], 'rivalry-bracket-team-name')
  const teamAName = participantName(rawA, isBye)
  const teamBName = participantName(rawB, isBye)
  const rawScoreA = classValue(teamParts[0], 'rivalry-bracket-team-score')
  const rawScoreB = classValue(teamParts[1], 'rivalry-bracket-team-score')
  const parsedScoreA = /^\d+$/.test(rawScoreA) ? Number(rawScoreA) : null
  const parsedScoreB = /^\d+$/.test(rawScoreB) ? Number(rawScoreB) : null
  const winnerA = /\brivalry-bracket-team-winner\b/i.test(teamParts[0].slice(0, 250))
  const winnerB = /\brivalry-bracket-team-winner\b/i.test(teamParts[1].slice(0, 250))
  const winnerSide = winnerA === winnerB ? null : winnerA ? 1 : 2

  // Rivalry can display a completed 0-0 row without identifying whether it was
  // a forfeit or an unreported score. That is not enough evidence to create a
  // result, so it remains unresolved unless the markup explicitly says BYE or forfeit.
  const ambiguousZeroResult = !isBye && !explicitForfeit && parsedScoreA === 0 && parsedScoreB === 0
  const scoredFinal = completed && parsedScoreA !== null && parsedScoreB !== null && parsedScoreA !== parsedScoreB
  const isFinal = Boolean(winnerSide && (isBye || explicitForfeit || (scoredFinal && !ambiguousZeroResult)))

  return {
    tier,
    roundName,
    roundOrder,
    matchOrder,
    teamAName,
    teamBName,
    scoreA: isFinal && !isBye && !explicitForfeit ? parsedScoreA : null,
    scoreB: isFinal && !isBye && !explicitForfeit ? parsedScoreB : null,
    winnerSide: isFinal ? winnerSide : null,
    isBye: isFinal && isBye,
    isForfeit: isFinal && explicitForfeit,
    isFinal,
  }
}

function parseRoundBlock(block: string, tier: string, roundName: string, roundOrder: number, matchOrderOffset = 0) {
  const starts = [...block.matchAll(/<div\s+class=["'][^"']*\brivalry-bracket-matchup\b[^"']*["'][^>]*>/gi)]
  return starts.map((start, index) => {
    const segment = block.slice(start.index!, starts[index + 1]?.index ?? block.length)
    return parseMatchup(segment, tier, roundName, roundOrder, matchOrderOffset + index + 1)
  }).filter((match): match is RivalryPlayoffMatch => match !== null)
}

export function parseRivalryPlayoffBracketHtml(html: string) {
  const errors: string[] = []
  const tierById = new Map(
    [...html.matchAll(/<option[^>]+value=["']([^"']+)["'][^>]*>\s*Tier\s+(\d+)\s*<\/option>/gi)]
      .map((match) => [match[1], match[2]]),
  )
  const containerStarts = [...html.matchAll(/<div\s+class=["'][^"']*\brivalry-bracket-container\b[^"']*["'][^>]*data-tier-id=["']([^"']+)["'][^>]*>/gi)]
  const matches: RivalryPlayoffMatch[] = []

  for (let index = 0; index < containerStarts.length; index += 1) {
    const start = containerStarts[index]
    const tier = tierById.get(start[1])
    if (!tier || !['4', '5', '6'].includes(tier)) continue
    const block = html.slice(start.index!, containerStarts[index + 1]?.index ?? html.length)
    const thirdIndex = block.search(/<div\s+class=["'][^"']*\brivalry-bracket-third-section\b/i)
    const mainBlock = thirdIndex >= 0 ? block.slice(0, thirdIndex) : block
    const roundStarts = [...mainBlock.matchAll(/<div\s+class=["'][^"']*\brivalry-bracket-round\b[^"']*["'][^>]*>/gi)]
    for (let roundIndex = 0; roundIndex < roundStarts.length; roundIndex += 1) {
      const roundBlock = mainBlock.slice(roundStarts[roundIndex].index!, roundStarts[roundIndex + 1]?.index ?? mainBlock.length)
      const round = normalizedRound(classValue(roundBlock, 'rivalry-bracket-round-title'))
      if (!round) continue
      matches.push(...parseRoundBlock(roundBlock, tier, round.name, round.order))
    }
    if (thirdIndex >= 0) {
      const thirdBlock = block.slice(thirdIndex)
      const third = parseRoundBlock(thirdBlock, tier, '3rd Place', 4, 1)[0]
      if (third) matches.push(third)
    }
  }

  for (const tier of ['4', '5', '6']) {
    const tierMatches = matches.filter((match) => match.tier === tier)
    if (tierMatches.length !== 16) errors.push(`Tier ${tier} parsed ${tierMatches.length} matches; expected 16.`)
  }
  const keys = matches.map((match) => `${match.tier}:${match.roundOrder}:${match.matchOrder}`)
  if (new Set(keys).size !== keys.length) errors.push('Rivalry bracket produced duplicate tier/round/match positions.')
  if (!matches.length) errors.push('No supported Rivalry playoff brackets were parsed.')
  return { matches, errors }
}

function sameName(left: string | null, right: string | null) {
  return normalizeLeagueIdentity(left) === normalizeLeagueIdentity(right)
}

export function buildRivalryPlayoffSyncPlan(source: RivalryPlayoffMatch[], existing: ExistingPlayoffMatch[], entries: PlayoffEntry[]) {
  const conflicts: string[] = []
  const updates: PlayoffSyncUpdate[] = []
  const entryByTierAndName = new Map(entries.map((entry) => [`${entry.tier}:${normalizeLeagueIdentity(entry.display_name_snapshot)}`, entry]))
  const existingByKey = new Map(existing.map((match) => [`${match.tier}:${match.round_order}:${match.match_order}`, match]))

  for (const incoming of source) {
    const key = `${incoming.tier}:${incoming.roundOrder}:${incoming.matchOrder}`
    const current = existingByKey.get(key)
    if (!current) {
      conflicts.push(`Missing local playoff position ${key}.`)
      continue
    }
    const patch: Record<string, unknown> = {}
    for (const side of ['A', 'B'] as const) {
      const incomingName = side === 'A' ? incoming.teamAName : incoming.teamBName
      const currentName = side === 'A' ? current.team_a_name : current.team_b_name
      if (incomingName && currentName && !sameName(incomingName, currentName)) {
        conflicts.push(`${key} participant ${side} changed from ${currentName} to ${incomingName}.`)
        continue
      }
      if (incomingName && !currentName) {
        const entry = entryByTierAndName.get(`${incoming.tier}:${normalizeLeagueIdentity(incomingName)}`)
        if (!entry) conflicts.push(`${key} participant ${incomingName} has no exact competition entry.`)
        else {
          patch[side === 'A' ? 'team_a_name' : 'team_b_name'] = incomingName
          patch[side === 'A' ? 'competition_entry_a_id' : 'competition_entry_b_id'] = entry.entry_id
        }
      }
    }

    if (current.status === 'final') {
      if (incoming.isFinal && (
        current.score_a !== incoming.scoreA || current.score_b !== incoming.scoreB ||
        current.winner_side !== incoming.winnerSide || Boolean(current.is_bye) !== incoming.isBye ||
        Boolean(current.is_forfeit) !== incoming.isForfeit
      )) conflicts.push(`${key} conflicts with an existing final result.`)
    } else if (incoming.isFinal) {
      Object.assign(patch, {
        score_a: incoming.scoreA,
        score_b: incoming.scoreB,
        winner_side: incoming.winnerSide,
        winner_name: incoming.winnerSide === 1 ? incoming.teamAName : incoming.teamBName,
        is_bye: incoming.isBye,
        is_forfeit: incoming.isForfeit,
        status: 'final',
      })
    }

    if (Object.keys(patch).length) updates.push({
      playoffMatchId: current.playoff_match_id,
      expectedStatus: current.status,
      expected: {
        team_a_name: current.team_a_name,
        team_b_name: current.team_b_name,
        competition_entry_a_id: current.competition_entry_a_id,
        competition_entry_b_id: current.competition_entry_b_id,
        score_a: current.score_a,
        score_b: current.score_b,
        winner_side: current.winner_side,
        is_bye: current.is_bye,
        is_forfeit: current.is_forfeit,
      },
      patch,
    })
  }
  return { updates, conflicts }
}
