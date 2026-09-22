import assert from 'node:assert/strict'
import {
  normalizeCompetitionPhase,
  phaseIsPowerEvidence,
  phaseMatchesFilter,
} from '../lib/competitionPhase.ts'
import { brandingForTeam } from '../lib/teamBranding.ts'

assert.equal(normalizeCompetitionPhase('Regular Season'), 'regular_season')
assert.equal(normalizeCompetitionPhase('playoffs'), 'playoffs')
assert.equal(normalizeCompetitionPhase('unknown'), null)
assert.equal(phaseMatchesFilter('playoffs', 'all'), true)
assert.equal(phaseMatchesFilter('playoffs', 'playoffs'), true)
assert.equal(phaseMatchesFilter('playoffs', 'regular_season'), false)
assert.equal(phaseMatchesFilter('regular_season', 'playoffs'), false)
assert.equal(phaseMatchesFilter('scrim', 'all'), false)
assert.equal(phaseIsPowerEvidence('regular_season'), true)
assert.equal(phaseIsPowerEvidence('playoffs'), true)
assert.equal(phaseIsPowerEvidence('scrim'), false)

const canonicalGames = [
  { id: 1, phase: 'regular_season', goals: 2 },
  { id: 2, phase: 'playoffs', goals: 3 },
]
const scopedGoals = (filter: 'all' | 'regular_season' | 'playoffs') => canonicalGames
  .filter((game) => phaseMatchesFilter(game.phase, filter))
  .reduce((sum, game) => sum + game.goals, 0)
assert.equal(scopedGoals('all'), 5, 'overall career and records include regular season plus playoffs')
assert.equal(scopedGoals('regular_season'), 2, 'regular-season scope excludes playoff games')
assert.equal(scopedGoals('playoffs'), 3, 'playoff scope excludes regular-season games')

const dataDriven = brandingForTeam({
  name: 'Flop Reset Test Squad',
  short_name: 'Test Squad',
  primary_color: '#112233',
  secondary_color: '#445566',
})
assert.equal(dataDriven.shortName, 'Test Squad')
assert.equal(dataDriven.primaryColor, '#112233')
assert.equal(dataDriven.secondaryColor, '#445566')
assert.equal(dataDriven.slug, 'flop-reset-test-squad')

console.log('Competition phase and data-driven branding tests passed.')
