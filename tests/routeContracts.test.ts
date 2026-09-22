import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function source(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
    'utf8'
  )
}

const missingEntityRoutes = [
  'app/players/[name]/page.tsx',
  'app/teams/[name]/page.tsx',
  'app/matches/[id]/page.tsx',
  'app/competitions/[id]/page.tsx',
  'app/league/players/[slug]/page.tsx',
  'app/league/teams/[slug]/page.tsx',
]

for (const route of missingEntityRoutes) {
  const contents = source(route)
  assert.match(contents, /from ['"]next\/navigation['"]/, `${route} must use Next navigation errors`)
  assert.match(contents, /\bnotFound\(\)/, `${route} must return a real HTTP 404 for a missing entity`)
}

const teamPage = source('app/teams/[name]/page.tsx')
assert.match(teamPage, /parseTeamId\(/, 'team profiles must parse the stable numeric team ID')
assert.match(teamPage, /\.eq\(['"]id['"],\s*teamId\)/, 'team profiles must query by stable ID')
assert.doesNotMatch(teamPage, /\.eq\(['"]name['"],/, 'team profiles must not resolve duplicate names by display name')

const playoffMapper = source('lib/playoffs.ts')
assert.match(playoffMapper, /isPlayoffMatchStatus\(rawStatus\)/, 'public playoff status must be validated against the canonical values')
assert.match(playoffMapper, /series \? ['"]final['"] : schedule \? ['"]scheduled['"] : ['"]tbd['"]/, 'derived playoff status must use final, scheduled, or tbd')
assert.doesNotMatch(playoffMapper, /series \? ['"]completed['"]|schedule \? ['"]scheduled['"] : ['"]pending['"]/, 'legacy completed and pending playoff fallbacks must not return')

console.log('Dynamic route 404 and stable identity contract tests passed.')
