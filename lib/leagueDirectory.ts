export const RIVALRY_PROVIDER = 'rivalry'
export const RIVALRY_PARSER_VERSION = 'RIVALRY_SOURCE_V1'

export type SourceRosterMember = {
  displayName: string
  role: 'captain' | 'player' | 'manager'
  status: string
  externalId: string | null
  sourceMemberKey: string
}

export type SourceCompetitionEntry = {
  displayName: string
  tier: string | null
  logoUrl: string | null
  externalTeamId: string | null
  sourceRegistrationKey: string
  roster: SourceRosterMember[]
}

export type RivalryCompetitionSnapshot = {
  provider: typeof RIVALRY_PROVIDER
  parserVersion: typeof RIVALRY_PARSER_VERSION
  externalCompetitionId: string
  sourceUrl: string
  title: string
  league: string
  circuit: string
  format: string
  region: string
  declaredEntryCount: number
  entries: SourceCompetitionEntry[]
  fetchedAt: string
}

export type RivalryTeamSnapshot = {
  provider: typeof RIVALRY_PROVIDER
  parserVersion: typeof RIVALRY_PARSER_VERSION
  externalTeamId: string
  sourceUrl: string
  displayName: string
  owner: string | null
  format: string | null
  region: string | null
  members: SourceRosterMember[]
}

export type DirectoryEntryLike = {
  entry_id?: number
  competition_id?: number
  display_name_snapshot: string
  tier?: string | null
  logo_url_snapshot?: string | null
  registration_status?: string | null
  competitive_status?: string | null
  source_registration_key?: string | null
  source_external_id?: string | null
  source_values?: Record<string, unknown> | null
  manual_values?: Record<string, unknown> | null
  locked_fields?: string[] | Record<string, boolean> | null
  status?: string | null
  competition_roster_members?: Array<{
    source_member_key: string
    display_name_snapshot?: string | null
    role?: string | null
    is_current?: boolean | null
  }> | null
}

export type SyncPreview = {
  newTeams: SourceCompetitionEntry[]
  changedTeams: Array<{ existing: DirectoryEntryLike; source: SourceCompetitionEntry; fields: string[] }>
  removedTeams: DirectoryEntryLike[]
  possibleDuplicates: Array<{ source: SourceCompetitionEntry; candidates: DirectoryEntryLike[] }>
  lockedConflicts: Array<{ existing: DirectoryEntryLike; source: SourceCompetitionEntry; field: string }>
  newRosterMembers: Array<{ team: string; member: SourceRosterMember }>
  removedRosterMembers: Array<{ team: string; member: { source_member_key: string; display_name_snapshot?: string | null } }>
  changedRosterMembers: Array<{ team: string; member: SourceRosterMember; fields: string[] }>
  unchanged: number
  sourceCount: number
  currentCount: number
  validationErrors: string[]
}

export function normalizeLeagueIdentity(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function leagueSlug(value: unknown, suffix?: string | number | null) {
  const base = normalizeLeagueIdentity(value).replace(/\s+/g, '-') || 'league-entry'
  return suffix === null || suffix === undefined || suffix === '' ? base : `${base}-${String(suffix).slice(-8).toLocaleLowerCase('en-US')}`
}

export function safePublicImageUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? ''))
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export function stableSourceKey(parts: unknown[]) {
  const value = parts.map((part) => normalizeLeagueIdentity(part)).join('|')
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `src_${(hash >>> 0).toString(36)}`
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
  }
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLocaleLowerCase('en-US')] ?? match)
}

function plainText(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function classText(html: string, className: string) {
  const match = html.match(new RegExp(`<[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'))
  return match ? plainText(match[1]) : ''
}

function labelValue(html: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(new RegExp(`>\\s*${escaped}\\s*<\\/[^>]+>[\\s\\S]{0,500}?<[^>]+>([^<]+)<`, 'i'))
  return match ? plainText(match[1]) : ''
}

function parseExternalCompetitionId(sourceUrl: string) {
  const match = sourceUrl.match(/\/competitions\/([^/?#]+)/i)
  return match?.[1] ?? ''
}

function normalizeRole(value: string): SourceRosterMember['role'] {
  const role = normalizeLeagueIdentity(value)
  if (role.includes('manager')) return 'manager'
  if (role.includes('captain')) return 'captain'
  return 'player'
}

export function parseRivalryCompetitionHtml(
  html: string,
  sourceUrl: string,
  fetchedAt = new Date().toISOString(),
): { snapshot: RivalryCompetitionSnapshot | null; errors: string[] } {
  const errors: string[] = []
  const externalCompetitionId = parseExternalCompetitionId(sourceUrl)
  if (!externalCompetitionId) errors.push('Source URL does not contain a Rivalry competition ID.')
  if (!/Event\s+Rosters/i.test(html)) errors.push('Event Rosters section was not found.')

  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const title = titleMatch ? plainText(titleMatch[1]) : ''
  const format = labelValue(html, 'Mode')
  const region = labelValue(html, 'Region')
  const league = labelValue(html, 'League') || 'RIVALRY'
  const circuit = labelValue(html, 'Season')
  const declaredMatch = html.match(/<[^>]*>\s*(\d+)\s+ROSTERS\s*<\/[^>]+>/i)
    ?? html.match(/>\s*Teams\s*<\/[^>]+>[\s\S]{0,300}?<[^>]+>\s*(\d+)\s*<\/[^>]+>/i)
  const declaredEntryCount = Number(declaredMatch?.[1] ?? 0)
  if (!title) errors.push('Competition title was not found.')
  if (!format) errors.push('Competition mode was not found.')
  if (!region) errors.push('Competition region was not found.')
  if (!declaredEntryCount) errors.push('Declared roster count was not found.')

  const eventIndex = html.search(/Event\s+Rosters/i)
  const eventHtml = eventIndex >= 0 ? html.slice(eventIndex) : html
  const cardParts = eventHtml.split(/<div\s+class=["'][^"']*\broster-card\b[^"']*["']/i).slice(1)
  const entries: SourceCompetitionEntry[] = []
  const registrationOccurrences = new Map<string, number>()

  for (const card of cardParts) {
    const displayName = classText(card, 'rivalry-roster-acc-name')
    if (!displayName) continue
    const tierText = classText(card, 'rivalry-roster-card-tier')
    const openingTag = card.slice(0, card.indexOf('>') + 1)
    const tierExternalId = openingTag.match(/data-tier-id=["']([^"']+)["']/i)?.[1] ?? ''
    const externalTeamId = openingTag.match(/data-team-id=["']([^"']+)["']/i)?.[1] ?? null
    const logoUrl = card.match(/(?:src|data-logo-url)=["']([^"']+)["']/i)?.[1] ?? null
    const people = [...card.matchAll(/<div\s+class=["'][^"']*\brivalry-roster-person\b[^"']*["'][^>]*>([\s\S]*?)(?=<div\s+class=["'][^"']*\brivalry-roster-person\b|<\/div>\s*<\/div>)/gi)]
      .map((match) => {
        const body = match[1]
        const personName = classText(body, 'rivalry-roster-person-name')
        const roleText = classText(body, 'rivalry-roster-person-role')
        const externalId = match[0].match(/data-(?:player|user)-id=["']([^"']+)["']/i)?.[1] ?? null
        return personName ? {
          displayName: personName,
          role: normalizeRole(roleText),
          status: classText(body, 'rivalry-circuit-pill') || 'registered',
          externalId,
          sourceMemberKey: externalId
            ? `${RIVALRY_PROVIDER}:player:${externalId}`
            : stableSourceKey([externalCompetitionId, displayName, personName, roleText]),
        } satisfies SourceRosterMember : null
      })
      .filter((member): member is SourceRosterMember => member !== null)

    const occurrenceIdentity = `${normalizeLeagueIdentity(tierExternalId || tierText)}|${normalizeLeagueIdentity(displayName)}`
    const occurrence = (registrationOccurrences.get(occurrenceIdentity) ?? 0) + 1
    registrationOccurrences.set(occurrenceIdentity, occurrence)
    const sourceRegistrationKey = externalTeamId
      ? `${RIVALRY_PROVIDER}:team:${externalTeamId}`
      : stableSourceKey([externalCompetitionId, tierExternalId || tierText, displayName, occurrence])

    entries.push({
      displayName,
      tier: tierText.replace(/^tier\s*/i, '').trim() || null,
      logoUrl,
      externalTeamId,
      sourceRegistrationKey,
      roster: people,
    })
  }

  if (declaredEntryCount && entries.length !== declaredEntryCount) {
    errors.push(`Parsed ${entries.length} event rosters but the source declares ${declaredEntryCount}.`)
  }
  if (entries.length === 0) errors.push('No event roster cards were parsed.')

  const duplicateKeys = entries.filter((entry, index) => entries.findIndex((candidate) => candidate.sourceRegistrationKey === entry.sourceRegistrationKey) !== index)
  if (duplicateKeys.length) errors.push('Duplicate source registration keys were produced; source apply is blocked.')

  if (errors.length) return { snapshot: null, errors }

  return {
    snapshot: {
      provider: RIVALRY_PROVIDER,
      parserVersion: RIVALRY_PARSER_VERSION,
      externalCompetitionId,
      sourceUrl,
      title,
      league,
      circuit,
      format,
      region,
      declaredEntryCount,
      entries,
      fetchedAt,
    },
    errors: [],
  }
}

export function parseRivalryTeamHtml(html: string, sourceUrl: string) {
  const errors: string[] = []
  const externalTeamId = sourceUrl.match(/\/teams\/([^/?#]+)/i)?.[1] ?? ''
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const displayName = titleMatch ? plainText(titleMatch[1]) : ''
  if (!externalTeamId) errors.push('Source URL does not contain a Rivalry team ID.')
  if (!displayName) errors.push('Team name was not found.')
  const userLinks = [...html.matchAll(/<a[^>]+href=["'][^"']*\/users\/([^/?#"']+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)]
  const members = userLinks.map((match) => {
    const externalId = match[1]
    const name = plainText(match[2])
    const before = html.slice(Math.max(0, match.index! - 350), match.index)
    const role = /manager/i.test(plainText(before).slice(-100)) ? 'manager' : /captain/i.test(plainText(before).slice(-100)) ? 'captain' : 'player'
    return {
      displayName: name,
      role: role as SourceRosterMember['role'],
      status: 'current',
      externalId,
      sourceMemberKey: `${RIVALRY_PROVIDER}:player:${externalId}`,
    }
  }).filter((member) => member.displayName)
  return {
    snapshot: errors.length ? null : {
      provider: RIVALRY_PROVIDER,
      parserVersion: RIVALRY_PARSER_VERSION,
      externalTeamId,
      sourceUrl,
      displayName,
      owner: labelValue(html, 'Owner') || null,
      format: labelValue(html, 'Mode') || null,
      region: labelValue(html, 'Region') || null,
      members,
    } satisfies RivalryTeamSnapshot,
    errors,
  }
}

export function lockedFieldSet(value: DirectoryEntryLike['locked_fields']) {
  if (Array.isArray(value)) return new Set(value.map(String))
  return new Set(Object.entries(value ?? {}).filter(([, locked]) => Boolean(locked)).map(([field]) => field))
}

export function effectiveSourceUpdate(existing: DirectoryEntryLike, source: SourceCompetitionEntry) {
  const locked = lockedFieldSet(existing.locked_fields)
  const sourceValues = {
    display_name_snapshot: source.displayName,
    tier: source.tier,
    logo_url_snapshot: source.logoUrl,
    source_external_id: source.externalTeamId,
  }
  const patch: Record<string, unknown> = { source_values: sourceValues }
  for (const [field, value] of Object.entries(sourceValues)) {
    if (!locked.has(field)) patch[field] = value
  }
  return patch
}

export function buildLeagueSyncPreview(
  snapshot: RivalryCompetitionSnapshot,
  currentEntries: DirectoryEntryLike[],
): SyncPreview {
  const byKey = new Map(currentEntries.filter((entry) => entry.source_registration_key).map((entry) => [entry.source_registration_key as string, entry]))
  const sourceKeys = new Set(snapshot.entries.map((entry) => entry.sourceRegistrationKey))
  const newTeams: SourceCompetitionEntry[] = []
  const changedTeams: SyncPreview['changedTeams'] = []
  const possibleDuplicates: SyncPreview['possibleDuplicates'] = []
  const lockedConflicts: SyncPreview['lockedConflicts'] = []
  const newRosterMembers: SyncPreview['newRosterMembers'] = []
  const removedRosterMembers: SyncPreview['removedRosterMembers'] = []
  const changedRosterMembers: SyncPreview['changedRosterMembers'] = []
  let unchanged = 0

  for (const source of snapshot.entries) {
    const existing = byKey.get(source.sourceRegistrationKey)
    if (!existing) {
      const candidates = currentEntries.filter((entry) => normalizeLeagueIdentity(entry.display_name_snapshot) === normalizeLeagueIdentity(source.displayName))
      if (candidates.length) possibleDuplicates.push({ source, candidates })
      newTeams.push(source)
      source.roster.forEach((member) => newRosterMembers.push({ team: source.displayName, member }))
      continue
    }

    const currentRoster = existing.competition_roster_members ?? []
    const rosterByKey = new Map(currentRoster.map((member) => [member.source_member_key, member]))
    const incomingKeys = new Set(source.roster.map((member) => member.sourceMemberKey))
    for (const member of source.roster) {
      const current = rosterByKey.get(member.sourceMemberKey)
      if (!current) newRosterMembers.push({ team: source.displayName, member })
      else {
        const fields = [current.display_name_snapshot !== member.displayName ? 'display_name_snapshot' : null, current.role !== member.role ? 'role' : null].filter((field): field is string => Boolean(field))
        if (fields.length) changedRosterMembers.push({ team: source.displayName, member, fields })
      }
    }
    currentRoster.filter((member) => member.is_current !== false && !incomingKeys.has(member.source_member_key)).forEach((member) => removedRosterMembers.push({ team: source.displayName, member }))

    const changedFields = [
      existing.display_name_snapshot !== source.displayName ? 'display_name_snapshot' : null,
      (existing.tier ?? null) !== source.tier ? 'tier' : null,
      (existing.logo_url_snapshot ?? null) !== source.logoUrl ? 'logo_url_snapshot' : null,
      (existing.source_external_id ?? null) !== source.externalTeamId ? 'source_external_id' : null,
    ].filter((field): field is string => Boolean(field))

    if (!changedFields.length) {
      unchanged += 1
      continue
    }

    changedTeams.push({ existing, source, fields: changedFields })
    const locked = lockedFieldSet(existing.locked_fields)
    for (const field of changedFields) {
      if (locked.has(field)) lockedConflicts.push({ existing, source, field })
    }
  }

  const removedTeams = currentEntries.filter((entry) => entry.source_registration_key && !sourceKeys.has(entry.source_registration_key))
  return {
    newTeams,
    changedTeams,
    removedTeams,
    possibleDuplicates,
    lockedConflicts,
    newRosterMembers,
    removedRosterMembers,
    changedRosterMembers,
    unchanged,
    sourceCount: snapshot.entries.length,
    currentCount: currentEntries.length,
    validationErrors: [],
  }
}

export function sourceSnapshotCanApply(snapshot: RivalryCompetitionSnapshot | null, errors: string[]) {
  return Boolean(snapshot && errors.length === 0 && snapshot.entries.length === snapshot.declaredEntryCount)
}

export function buildDirectoryReconciliation({
  snapshot,
  currentEntries,
  powerTeamNames,
  aliasNames = [],
}: {
  snapshot: RivalryCompetitionSnapshot
  currentEntries: DirectoryEntryLike[]
  powerTeamNames: string[]
  aliasNames?: string[]
}) {
  const sourceNames = new Set(snapshot.entries.map((entry) => normalizeLeagueIdentity(entry.displayName)))
  const currentNames = new Set(currentEntries.map((entry) => normalizeLeagueIdentity(entry.display_name_snapshot)))
  const powerNames = new Set(powerTeamNames.map(normalizeLeagueIdentity).filter(Boolean))
  const aliases = new Set(aliasNames.map(normalizeLeagueIdentity).filter(Boolean))
  const intersection = [...sourceNames].filter((name) => currentNames.has(name))
  const rivalryOnly = [...sourceNames].filter((name) => !currentNames.has(name))
  const frOnly = [...currentNames].filter((name) => !sourceNames.has(name))
  const duplicateExternalIds = snapshot.entries
    .map((entry) => entry.externalTeamId)
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) !== index)
  const aliasMatches = snapshot.entries.filter((entry) => aliases.has(normalizeLeagueIdentity(entry.displayName))).length
  const manualMatches = currentEntries.filter((entry) => !entry.source_external_id && Boolean(entry.source_registration_key)).length
  return {
    rivalryRegisteredEntries: snapshot.entries.length,
    frCompetitionEntries: currentEntries.length,
    powerResultDistinctTeams: powerNames.size,
    intersection: intersection.length,
    rivalryOnly: rivalryOnly.length,
    frOnly: frOnly.length,
    unresolved: rivalryOnly.filter((name) => !aliases.has(name)).length,
    duplicateSourceIdentities: new Set(duplicateExternalIds).size,
    aliasMatches,
    manualMatches,
    powerFieldOnly: [...powerNames].filter((name) => !sourceNames.has(name)).length,
  }
}

export function archiveRemovedRosterMembers<T extends { source_member_key: string; is_current?: boolean; status?: string }>(
  current: T[],
  incoming: SourceRosterMember[],
) {
  const keys = new Set(incoming.map((member) => member.sourceMemberKey))
  return current.map((member) => keys.has(member.source_member_key)
    ? member
    : { ...member, is_current: false, status: 'removed' })
}

export function directoryCoverage(entry: {
  rosterCount?: number
  leagueResultCount?: number
  hasPower?: boolean
  frMeetingCount?: number
  detailedReplayCount?: number
}) {
  return {
    leagueEntry: true,
    roster: Number(entry.rosterCount ?? 0) > 0,
    leagueResults: Number(entry.leagueResultCount ?? 0) > 0,
    power: Boolean(entry.hasPower),
    frMeetings: Number(entry.frMeetingCount ?? 0) > 0,
    detailedReplayStats: Number(entry.detailedReplayCount ?? 0) > 0,
  }
}
