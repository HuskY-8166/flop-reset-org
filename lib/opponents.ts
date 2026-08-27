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

export function normalizeOpponentName(value: string) {
  return value.trim().toLocaleLowerCase('en-US')
}

export function buildOpponentIdentityIndex(opponents: OpponentRow[], aliases: OpponentAliasRow[]) {
  const byId = new Map<number, OpponentIdentity>()
  const byName = new Map<string, OpponentIdentity>()

  for (const opponent of opponents) {
    const opponentId = Number(opponent.opponent_id)
    const canonicalName = opponent.canonical_name?.trim()
    if (!Number.isFinite(opponentId) || !canonicalName) continue
    const identity = { opponentId, canonicalName, aliases: [] as string[] }
    byId.set(opponentId, identity)
    byName.set(normalizeOpponentName(canonicalName), identity)
  }

  for (const alias of aliases) {
    const identity = byId.get(Number(alias.opponent_id))
    const value = alias.alias?.trim()
    if (!identity || !value) continue
    if (!identity.aliases.includes(value)) identity.aliases.push(value)
    byName.set(normalizeOpponentName(value), identity)
  }

  return {
    byId,
    resolve({ opponentId, snapshotName }: { opponentId?: number | string | null; snapshotName?: string | null }) {
      const id = Number(opponentId)
      if (Number.isFinite(id) && byId.has(id)) return byId.get(id)!
      if (snapshotName) return byName.get(normalizeOpponentName(snapshotName)) ?? null
      return null
    },
    find(name: string) {
      return byName.get(normalizeOpponentName(name)) ?? null
    },
  }
}
