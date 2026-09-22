import assert from 'node:assert/strict'
import { applyAtomicSyncPlanInMemory, buildRivalryPlayoffSyncPlan, parseRivalryPlayoffBracketHtml, type ExistingPlayoffMatch } from '../lib/rivalryPlayoffs.ts'

function matchup(a: string, b: string, scoreA?: number, scoreB?: number, winner: 1 | 2 | null = null, extra = '') {
  const complete = scoreA === undefined ? '' : ' rivalry-bracket-matchup-completed'
  return `<div class="rivalry-bracket-matchup${complete} ${extra}">
    <div class="rivalry-bracket-team ${winner === 1 ? 'rivalry-bracket-team-winner' : ''}"><span class="rivalry-bracket-team-name">${a}</span>${scoreA === undefined ? '' : `<span class="rivalry-bracket-team-score">${scoreA}</span>`}</div>
    <div class="rivalry-bracket-team ${winner === 2 ? 'rivalry-bracket-team-winner' : ''}"><span class="rivalry-bracket-team-name">${b}</span>${scoreB === undefined ? '' : `<span class="rivalry-bracket-team-score">${scoreB}</span>`}</div>
  </div>`
}

function tier(tierNumber: string, id: string) {
  const opening = Array.from({ length: 8 }, (_, index) => index === 1
    ? matchup('SuperSonic DADS', 'EC United', 0, 0, 2)
    : matchup(`T${tierNumber} A${index + 1}`, `T${tierNumber} B${index + 1}`, 4, index % 3, 1)).join('')
  const quarters = Array.from({ length: 4 }, (_, index) => matchup(`Q${index + 1}A`, `Q${index + 1}B`)).join('')
  const semis = Array.from({ length: 2 }, (_, index) => matchup(`S${index + 1}A`, `S${index + 1}B`)).join('')
  return `<div class="rivalry-bracket-container" data-tier-id="${id}">
    <div class="rivalry-bracket-round"><div class="rivalry-bracket-round-title">Opening Round</div>${opening}</div>
    <div class="rivalry-bracket-round"><div class="rivalry-bracket-round-title">Quarterfinals</div>${quarters}</div>
    <div class="rivalry-bracket-round"><div class="rivalry-bracket-round-title">Semifinals</div>${semis}</div>
    <div class="rivalry-bracket-round"><div class="rivalry-bracket-round-title">Finals</div>${matchup('Final A', 'Final B')}</div>
    <div class="rivalry-bracket-third-section">${matchup('SF Loser 1', 'SF Loser 2')}</div>
  </div>`
}

const html = `<select>${['4', '5', '6'].map((number) => `<option value="tier-${number}">Tier ${number}</option>`).join('')}</select>${['4', '5', '6'].map((number) => tier(number, `tier-${number}`)).join('')}`
const parsed = parseRivalryPlayoffBracketHtml(html)
assert.deepEqual(parsed.errors, [])
assert.equal(parsed.matches.length, 48)
assert.equal(parsed.matches.find((match) => match.tier === '6' && match.roundName === '3rd Place')?.matchOrder, 2)
const ambiguous = parsed.matches.find((match) => match.tier === '6' && match.roundName === 'Opening Round' && match.matchOrder === 2)!
assert.equal(ambiguous.isFinal, false, 'completed 0-0 without explicit forfeit evidence remains unresolved')
assert.equal(ambiguous.winnerSide, null)

const existing: ExistingPlayoffMatch[] = parsed.matches.map((match, index) => ({
  playoff_match_id: index + 1,
  bracket_id: Number(match.tier),
  tier: match.tier,
  round_name: match.roundName,
  round_order: match.roundOrder,
  match_order: match.matchOrder,
  team_a_name: match.teamAName,
  team_b_name: match.teamBName,
  competition_entry_a_id: null,
  competition_entry_b_id: null,
  score_a: null,
  score_b: null,
  winner_side: null,
  status: 'tbd',
  is_bye: false,
  is_forfeit: false,
}))
const plan = buildRivalryPlayoffSyncPlan(parsed.matches, existing, [])
assert.deepEqual(plan.conflicts, [])
assert.equal(plan.updates.length, 21, 'seven conclusive opening results per tier are planned')
assert.equal(plan.updates.some((update) => update.playoffMatchId === ambiguous.matchOrder), false, 'ambiguous EC United result is not updated')

const conflicting = structuredClone(existing)
conflicting[0].status = 'final'
conflicting[0].score_a = 3
conflicting[0].score_b = 4
conflicting[0].winner_side = 2
assert.equal(buildRivalryPlayoffSyncPlan(parsed.matches, conflicting, []).conflicts.length, 1, 'an existing final is never silently rewritten')

const twoRows = structuredClone([existing[0], existing[2]])
const twoUpdates = buildRivalryPlayoffSyncPlan([parsed.matches[0], parsed.matches[2]], twoRows, []).updates
const applied = applyAtomicSyncPlanInMemory(twoRows, twoUpdates)
assert.equal(applied.filter((row) => row.status === 'final').length, 2, 'a valid multi-row plan applies completely')
const staleRows = structuredClone(twoRows)
staleRows[1].team_a_name = 'Manual override'
assert.throws(() => applyAtomicSyncPlanInMemory(staleRows, twoUpdates), /changed during synchronization/)
assert.deepEqual(staleRows[0], twoRows[0], 'a second-row conflict leaves the first row unchanged')

const legacyCompleted = structuredClone(existing.slice(0, 1))
legacyCompleted[0].status = 'completed'
assert.equal(buildRivalryPlayoffSyncPlan(parsed.matches.slice(0, 1), legacyCompleted, []).updates[0]?.patch.status, 'final', 'completed is not a canonical finalized playoff status')

console.log('Rivalry playoff parser and fail-closed sync planner tests passed.')
