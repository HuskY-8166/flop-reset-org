export type CompetitionRosterMember = {
  roster_member_id: number
  display_name_snapshot: string
  league_player_id?: number | null
}

export type LeaguePlayerLink = {
  league_player_id: number
  linked_fr_player_id?: number | null
}

export type CanonicalRosterPlayer = {
  player_id: number
  name: string
  aliases?: string[] | null
  team_id: number
}

export type ResolvedImportRosterPlayer = {
  player_id: number
  name: string
  aliases: string[]
  roster_member_id: number
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('en-US')
}

function matchesSnapshot(player: CanonicalRosterPlayer, snapshot: string) {
  const target = normalize(snapshot)
  return normalize(player.name) === target ||
    (player.aliases ?? []).some((alias) => normalize(alias) === target)
}

export function resolveCompetitionImportRoster({
  members,
  leaguePlayers,
  teamPlayers,
  canonicalTeamId,
}: {
  members: CompetitionRosterMember[]
  leaguePlayers: LeaguePlayerLink[]
  teamPlayers: CanonicalRosterPlayer[]
  canonicalTeamId: number
}) {
  const eligiblePlayers = teamPlayers.filter(
    (player) => Number(player.team_id) === Number(canonicalTeamId),
  )
  const playerById = new Map(
    eligiblePlayers.map((player) => [Number(player.player_id), player]),
  )
  const linkedPlayerByLeagueId = new Map(
    leaguePlayers.flatMap((player) => {
      const linkedId = Number(player.linked_fr_player_id)
      return Number.isFinite(linkedId)
        ? [[Number(player.league_player_id), linkedId] as const]
        : []
    }),
  )
  const usedPlayerIds = new Set<number>()
  const players: ResolvedImportRosterPlayer[] = []
  const unresolved: Array<{ roster_member_id: number; name: string; reason: string }> = []

  for (const member of members) {
    const linkedId = member.league_player_id == null
      ? null
      : linkedPlayerByLeagueId.get(Number(member.league_player_id)) ?? null
    const linkedPlayer = linkedId == null ? null : playerById.get(linkedId) ?? null
    const nameMatches = eligiblePlayers.filter((player) =>
      matchesSnapshot(player, member.display_name_snapshot),
    )
    const candidates = linkedPlayer ? [linkedPlayer] : nameMatches

    if (candidates.length !== 1) {
      unresolved.push({
        roster_member_id: member.roster_member_id,
        name: member.display_name_snapshot,
        reason: candidates.length === 0
          ? 'No canonical player on the selected competition entry team.'
          : 'Multiple canonical players on the selected competition entry team match this snapshot.',
      })
      continue
    }

    const player = candidates[0]
    if (usedPlayerIds.has(Number(player.player_id))) {
      unresolved.push({
        roster_member_id: member.roster_member_id,
        name: member.display_name_snapshot,
        reason: 'The canonical player is already assigned to another roster row.',
      })
      continue
    }
    usedPlayerIds.add(Number(player.player_id))
    players.push({
      player_id: Number(player.player_id),
      name: member.display_name_snapshot,
      aliases: [...new Set([
        player.name,
        ...(player.aliases ?? []),
      ].filter((alias) => normalize(alias) !== normalize(member.display_name_snapshot)))],
      roster_member_id: member.roster_member_id,
    })
  }

  return { players, unresolved, total: members.length }
}
