export type ImportRosterPlayer = {
  player_id: number
  name: string
  aliases?: string[] | null
}

export type CsvIdentityRow = {
  rawName: string
  teamName: string
  goals: number | null
  source?: unknown
}

export type ResolvedIdentity = {
  rawName: string
  player: ImportRosterPlayer
  source: 'canonical' | 'alias' | 'normalized-canonical' | 'normalized-alias'
}

export type ReplaySideResolution = {
  frRows: Array<{ row: CsvIdentityRow; identity: ResolvedIdentity | null }>
  opponentRows: CsvIdentityRow[]
  resolved: ResolvedIdentity[]
  unresolvedFrNames: string[]
  opponentPlayerNames: string[]
  frTeamName: string
  opponentTeamName: string
  ourGoals: number | null
  theirGoals: number | null
  errors: string[]
}

export function normalizeImportIdentity(value: string) {
  return value.trim().toLocaleLowerCase('en-US')
}

export function expectedPlayersForFormat(format: string) {
  const match = format.trim().toLocaleLowerCase('en-US').match(/^(\d+)v\1$/)
  return match ? Number(match[1]) : null
}

export function resolveRosterIdentity(
  rawName: string,
  roster: ImportRosterPlayer[],
): ResolvedIdentity | null {
  const trimmed = rawName.trim()
  const normalized = normalizeImportIdentity(trimmed)
  const canonical = roster.find((player) => player.name.trim() === trimmed)
  if (canonical) return { rawName, player: canonical, source: 'canonical' }

  const alias = roster.find((player) =>
    (player.aliases ?? []).some((value) => value.trim() === trimmed),
  )
  if (alias) return { rawName, player: alias, source: 'alias' }

  const normalizedCanonical = roster.find(
    (player) => normalizeImportIdentity(player.name) === normalized,
  )
  if (normalizedCanonical) {
    return { rawName, player: normalizedCanonical, source: 'normalized-canonical' }
  }

  const normalizedAlias = roster.find((player) =>
    (player.aliases ?? []).some(
      (value) => normalizeImportIdentity(value) === normalized,
    ),
  )
  return normalizedAlias
    ? { rawName, player: normalizedAlias, source: 'normalized-alias' }
    : null
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

export function identifyReplaySides({
  rows,
  roster,
  selectedTeam,
  format,
}: {
  rows: CsvIdentityRow[]
  roster: ImportRosterPlayer[]
  selectedTeam: string
  format: string
}): ReplaySideResolution {
  const errors: string[] = []
  const expected = expectedPlayersForFormat(format)
  if (!expected) errors.push(`Unsupported competition format: ${format || 'unknown'}.`)

  const missingTeamRows = rows.filter((row) => !row.teamName.trim())
  if (missingTeamRows.length) {
    errors.push('CSV team identity is missing for one or more player rows.')
  }

  const sides = new Map<string, CsvIdentityRow[]>()
  for (const row of rows) {
    if (!row.teamName.trim()) continue
    const key = normalizeImportIdentity(row.teamName)
    sides.set(key, [...(sides.get(key) ?? []), row])
  }
  if (sides.size !== 2) {
    errors.push(`Expected exactly two CSV team sides; found ${sides.size}.`)
  }

  const sideEntries = [...sides.entries()].map(([key, sideRows]) => ({
    key,
    rows: sideRows,
    identities: sideRows.map((row) => resolveRosterIdentity(row.rawName, roster)),
  }))
  const selectedKey = normalizeImportIdentity(selectedTeam)
  let frSide = sideEntries.find((side) => side.key === selectedKey)

  if (!frSide) {
    const rosterSides = sideEntries.filter((side) => side.identities.some(Boolean))
    if (rosterSides.length === 1) frSide = rosterSides[0]
    else errors.push('Could not identify one unambiguous Flop Reset side in this replay.')
  }

  const opponentSide = frSide
    ? sideEntries.find((side) => side.key !== frSide?.key)
    : undefined
  if (frSide && !opponentSide) errors.push('Could not identify the opponent side in this replay.')

  const frRows = (frSide?.rows ?? []).map((row, index) => ({
    row,
    identity: frSide?.identities[index] ?? null,
  }))
  const opponentRows = opponentSide?.rows ?? []
  const resolved = frRows.flatMap(({ identity }) => identity ? [identity] : [])
  const unresolvedFrNames = unique(
    frRows.filter(({ identity }) => !identity).map(({ row }) => row.rawName),
  )

  if (expected && frRows.length !== expected) {
    errors.push(`Expected ${expected} Flop Reset player rows; found ${frRows.length}.`)
  }
  if (expected && opponentRows.length !== expected) {
    errors.push(`Expected ${expected} opponent player rows; found ${opponentRows.length}.`)
  }
  if (unresolvedFrNames.length) {
    errors.push(`Unresolved Flop Reset players: ${unresolvedFrNames.join(', ')}.`)
  }
  if (new Set(resolved.map((identity) => identity.player.player_id)).size !== resolved.length) {
    errors.push('A Flop Reset player identity appears more than once in the same replay.')
  }
  if (opponentSide?.identities.some(Boolean)) {
    errors.push('Known Flop Reset identities appear on both CSV sides; team identification is ambiguous.')
  }

  const scoreAvailable = frRows.length > 0 && opponentRows.length > 0 &&
    [...frRows.map(({ row }) => row), ...opponentRows].every((row) => row.goals !== null)
  if (!scoreAvailable) errors.push('Game score cannot be reconstructed from the two identified sides.')

  return {
    frRows,
    opponentRows,
    resolved,
    unresolvedFrNames,
    opponentPlayerNames: unique(opponentRows.map((row) => row.rawName)),
    frTeamName: frSide?.rows[0]?.teamName ?? '',
    opponentTeamName: opponentSide?.rows[0]?.teamName ?? '',
    ourGoals: scoreAvailable
      ? frRows.reduce((sum, { row }) => sum + Number(row.goals), 0)
      : null,
    theirGoals: scoreAvailable
      ? opponentRows.reduce((sum, row) => sum + Number(row.goals), 0)
      : null,
    errors,
  }
}
