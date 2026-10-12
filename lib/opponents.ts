export type OpponentRow = {
  opponent_id: number | string
  canonical_name?: string | null
}

export type OpponentAliasRow = {
  opponent_id: number | string
  alias?: string | null
  normalized_alias?: string | null
}

export type OpponentIdentity = {
  opponentId: number
  canonicalName: string
  aliases: string[]
}

export type ImportOpponentResolution = {
  opponentId: number | null
  canonicalName: string | null
  errors: string[]
  warnings: string[]
}

export function normalizeOpponentName(value: string) {
  return value.trim().toLocaleLowerCase('en-US')
}

export function buildOpponentIdentityIndex(opponents: OpponentRow[], aliases: OpponentAliasRow[]) {
  const byId = new Map<number, OpponentIdentity>()
  const byName = new Map<string, OpponentIdentity>()
  const ambiguousNames = new Set<string>()

  const registerName = (value: string, identity: OpponentIdentity) => {
    const normalized = normalizeOpponentName(value)
    const existing = byName.get(normalized)
    if (existing && existing.opponentId !== identity.opponentId) {
      byName.delete(normalized)
      ambiguousNames.add(normalized)
      return
    }
    if (!ambiguousNames.has(normalized)) byName.set(normalized, identity)
  }

  for (const opponent of opponents) {
    const opponentId = Number(opponent.opponent_id)
    const canonicalName = opponent.canonical_name?.trim()
    if (!Number.isFinite(opponentId) || !canonicalName) continue
    const identity = { opponentId, canonicalName, aliases: [] as string[] }
    byId.set(opponentId, identity)
    registerName(canonicalName, identity)
  }

  for (const alias of aliases) {
    const identity = byId.get(Number(alias.opponent_id))
    const value = alias.alias?.trim()
    if (!identity || !value) continue
    if (!identity.aliases.includes(value)) identity.aliases.push(value)
    registerName(value, identity)
  }

  return {
    byId,
    resolve({ opponentId, snapshotName }: { opponentId?: number | string | null; snapshotName?: string | null }) {
      const id = Number(opponentId)
      if (Number.isFinite(id) && byId.has(id)) return byId.get(id)!
      if (snapshotName && !ambiguousNames.has(normalizeOpponentName(snapshotName))) {
        return byName.get(normalizeOpponentName(snapshotName)) ?? null
      }
      return null
    },
    find(name: string) {
      if (ambiguousNames.has(normalizeOpponentName(name))) return null
      return byName.get(normalizeOpponentName(name)) ?? null
    },
  }
}

export function resolveImportOpponent({
  csvOpponentName,
  csvIdentity,
  fixtureLinked,
  fixtureIdentity,
}: {
  csvOpponentName: string
  csvIdentity: OpponentIdentity | null
  fixtureLinked: boolean
  fixtureIdentity: OpponentIdentity | null
}): ImportOpponentResolution {
  const csvName = csvOpponentName.trim()

  if (!csvName) {
    return {
      opponentId: null,
      canonicalName: null,
      errors: ['Opponent identity is missing.'],
      warnings: [],
    }
  }

  if (fixtureLinked) {
    if (!fixtureIdentity) {
      return {
        opponentId: null,
        canonicalName: null,
        errors: ['The linked fixture does not have a verified canonical opponent identity.'],
        warnings: [],
      }
    }

    const differs = normalizeOpponentName(csvName) !== normalizeOpponentName(fixtureIdentity.canonicalName)
    return {
      opponentId: fixtureIdentity.opponentId,
      canonicalName: fixtureIdentity.canonicalName,
      errors: [],
      warnings: differs
        ? [`CSV opponent "${csvName}" differs from fixture opponent "${fixtureIdentity.canonicalName}". Fixture identity will be used.`]
        : [],
    }
  }

  if (!csvIdentity) {
    return {
      opponentId: null,
      canonicalName: null,
      errors: ['Opponent identity is unresolved. Resolve it in League Directory before import.'],
      warnings: [],
    }
  }

  return {
    opponentId: csvIdentity.opponentId,
    canonicalName: csvIdentity.canonicalName,
    errors: [],
    warnings: [],
  }
}
