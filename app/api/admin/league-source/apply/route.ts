import { effectiveSourceUpdate, leagueSlug, normalizeLeagueIdentity, type RivalryCompetitionSnapshot } from '@/lib/leagueDirectory'
import { requireSiteAdmin } from '@/lib/adminServer'

export const runtime = 'nodejs'

function locked(fields: unknown, field: string) {
  return Array.isArray(fields) ? fields.includes(field) : Boolean(fields && typeof fields === 'object' && (fields as Record<string, unknown>)[field])
}

export async function POST(request: Request) {
  const { client, user, error: authError } = await requireSiteAdmin(request)
  if (authError || !user) return Response.json({ error: authError }, { status: 403 })
  const body = await request.json().catch(() => ({})) as { snapshotId?: unknown }
  const snapshotId = Number(body.snapshotId)
  if (!Number.isInteger(snapshotId) || snapshotId < 1) return Response.json({ error: 'A reviewed preview snapshot is required.' }, { status: 400 })

  const { data: snapshotRow, error: snapshotError } = await client.from('external_source_snapshots')
    .select('*, competition_sources(*)').eq('snapshot_id', snapshotId).single()
  if (snapshotError || !snapshotRow) return Response.json({ error: snapshotError?.message ?? 'Preview snapshot was not found.' }, { status: 404 })
  if (snapshotRow.status === 'applied') return Response.json({ applied: false, idempotent: true, message: 'This exact source snapshot was already applied.' })
  if (snapshotRow.status !== 'preview' || snapshotRow.validation_errors?.length) return Response.json({ error: 'Only a validated preview can be applied.' }, { status: 409 })

  const source = Array.isArray(snapshotRow.competition_sources) ? snapshotRow.competition_sources[0] : snapshotRow.competition_sources
  const competitionId = Number(source?.competition_id)
  const snapshot = snapshotRow.normalized_payload as RivalryCompetitionSnapshot
  if (!competitionId || !snapshot?.entries?.length || snapshot.entries.length !== snapshot.declaredEntryCount) {
    return Response.json({ error: 'Snapshot validation no longer passes; no changes were applied.' }, { status: 409 })
  }

  const { data: currentEntries, error: currentError } = await client.from('competition_entries').select('*').eq('competition_id', competitionId)
  if (currentError) return Response.json({ error: currentError.message }, { status: 500 })
  const byKey = new Map((currentEntries ?? []).filter((entry) => entry.source_registration_key).map((entry) => [entry.source_registration_key, entry]))
  const sourceKeys = new Set(snapshot.entries.map((entry) => entry.sourceRegistrationKey))
  const now = new Date().toISOString()
  const counters = { created: 0, updated: 0, archived: 0, rosterCreated: 0, rosterArchived: 0, unresolved: 0 }

  for (const sourceEntry of snapshot.entries) {
    let externalSource: Record<string, unknown> | null = null
    if (sourceEntry.externalTeamId) {
      const externalResult = await client.from('external_team_sources').select('*')
        .eq('provider', 'rivalry').eq('external_team_id', sourceEntry.externalTeamId).maybeSingle()
      if (externalResult.error) return Response.json({ error: externalResult.error.message }, { status: 500 })
      externalSource = externalResult.data
      if (!externalSource) {
        const createdSource = await client.from('external_team_sources').insert({
          provider: 'rivalry', external_team_id: sourceEntry.externalTeamId,
          source_url: `https://therivalry.gg/teams/${sourceEntry.externalTeamId}`,
          source_display_name: sourceEntry.displayName, mode: snapshot.format, region: snapshot.region,
          last_synced_at: now, raw_metadata: { competition_id: snapshot.externalCompetitionId },
        }).select().single()
        if (createdSource.error || !createdSource.data) return Response.json({ error: createdSource.error?.message ?? 'External team mapping creation failed.' }, { status: 500 })
        externalSource = createdSource.data
      }
    }

    const existing = byKey.get(sourceEntry.sourceRegistrationKey)
    const base = {
      competition_id: competitionId,
      external_source_id: externalSource?.source_id ?? null,
      opponent_id: externalSource?.opponent_id ?? null,
      source_registration_key: sourceEntry.sourceRegistrationKey,
      source_provider: 'rivalry',
      source_external_id: sourceEntry.externalTeamId,
      source_url: snapshot.sourceUrl,
      registration_status: 'registered',
      status: 'active',
      left_at: null,
      updated_at: now,
    }
    let entry: Record<string, unknown>
    if (existing) {
      const { data, error } = await client.from('competition_entries').update({ ...base, ...effectiveSourceUpdate(existing, sourceEntry) })
        .eq('entry_id', existing.entry_id).select().single()
      if (error || !data) return Response.json({ error: error?.message ?? 'Competition entry update failed.' }, { status: 500 })
      entry = data
      counters.updated += 1
    } else {
      const { data, error } = await client.from('competition_entries').insert({
        ...base,
        fr_team_id: null,
        display_name_snapshot: sourceEntry.displayName,
        logo_url_snapshot: sourceEntry.logoUrl,
        tier: sourceEntry.tier,
        competitive_status: 'pending',
        is_power_tracked: false,
        source_values: {
          display_name_snapshot: sourceEntry.displayName,
          tier: sourceEntry.tier,
          logo_url_snapshot: sourceEntry.logoUrl,
          source_external_id: sourceEntry.externalTeamId,
        },
        slug: leagueSlug(sourceEntry.displayName, sourceEntry.sourceRegistrationKey),
      }).select().single()
      if (error || !data) return Response.json({ error: error?.message ?? 'Competition entry creation failed.' }, { status: 500 })
      entry = data
      counters.created += 1
    }

    if (!entry.fr_team_id && !entry.opponent_id) {
      const { data: openIssue } = await client.from('identity_reconciliation_queue').select('reconciliation_id')
        .eq('competition_id', competitionId).eq('entity_type', 'competition_entry')
        .eq('source_display_name', sourceEntry.displayName).eq('issue_type', 'unknown_team').eq('status', 'open').maybeSingle()
      if (!openIssue) await client.from('identity_reconciliation_queue').insert({
        competition_id: competitionId, entity_type: 'competition_entry', source_provider: 'rivalry',
        source_external_id: sourceEntry.externalTeamId, source_display_name: sourceEntry.displayName,
        issue_type: 'unknown_team', details: { entry_id: entry.entry_id, source_registration_key: sourceEntry.sourceRegistrationKey },
      })
      counters.unresolved += 1
    }

    const { data: currentRoster, error: rosterError } = await client.from('competition_roster_members').select('*').eq('entry_id', entry.entry_id)
    if (rosterError) return Response.json({ error: rosterError.message }, { status: 500 })
    const rosterByKey = new Map((currentRoster ?? []).map((member) => [member.source_member_key, member]))
    const incomingMemberKeys = new Set(sourceEntry.roster.map((member) => member.sourceMemberKey))

    for (const sourceMember of sourceEntry.roster) {
      let leaguePlayerId: number | null = null
      if (sourceMember.externalId) {
        const existingPlayer = await client.from('league_players').select('*').eq('source_provider', 'rivalry').eq('source_external_id', sourceMember.externalId).maybeSingle()
        if (existingPlayer.error) return Response.json({ error: existingPlayer.error.message }, { status: 500 })
        if (existingPlayer.data) {
          leaguePlayerId = Number(existingPlayer.data.league_player_id)
          if (!locked(existingPlayer.data.locked_fields, 'canonical_name')) {
            await client.from('league_players').update({ canonical_name: sourceMember.displayName, display_name: sourceMember.displayName, normalized_name: normalizeLeagueIdentity(sourceMember.displayName), source_values: { canonical_name: sourceMember.displayName }, updated_at: now }).eq('league_player_id', leaguePlayerId)
          }
        } else {
          const created = await client.from('league_players').insert({
            slug: leagueSlug(sourceMember.displayName, sourceMember.externalId), canonical_name: sourceMember.displayName,
            display_name: sourceMember.displayName, normalized_name: normalizeLeagueIdentity(sourceMember.displayName),
            source_provider: 'rivalry', source_external_id: sourceMember.externalId,
            source_values: { canonical_name: sourceMember.displayName },
          }).select().single()
          if (created.error || !created.data) return Response.json({ error: created.error?.message ?? 'League player creation failed.' }, { status: 500 })
          leaguePlayerId = Number(created.data.league_player_id)
        }
      }

      const rosterExisting = rosterByKey.get(sourceMember.sourceMemberKey)
      const rosterPatch = {
        league_player_id: leaguePlayerId,
        display_name_snapshot: rosterExisting && locked(rosterExisting.locked_fields, 'display_name_snapshot') ? rosterExisting.display_name_snapshot : sourceMember.displayName,
        role: rosterExisting && locked(rosterExisting.locked_fields, 'role') ? rosterExisting.role : sourceMember.role,
        status: 'active', is_current: true, left_at: null,
        source_provider: 'rivalry', source_external_id: sourceMember.externalId,
        source_values: { display_name_snapshot: sourceMember.displayName, role: sourceMember.role, status: sourceMember.status },
        updated_at: now,
      }
      if (rosterExisting) {
        const rosterUpdate = await client.from('competition_roster_members').update(rosterPatch).eq('roster_member_id', rosterExisting.roster_member_id)
        if (rosterUpdate.error) return Response.json({ error: rosterUpdate.error.message }, { status: 500 })
      } else {
        const rosterInsert = await client.from('competition_roster_members').insert({ ...rosterPatch, entry_id: entry.entry_id, source_member_key: sourceMember.sourceMemberKey, joined_at: now })
        if (rosterInsert.error) return Response.json({ error: rosterInsert.error.message }, { status: 500 })
        counters.rosterCreated += 1
      }
    }

    const removedIds = (currentRoster ?? []).filter((member) => member.is_current && !incomingMemberKeys.has(member.source_member_key)).map((member) => member.roster_member_id)
    if (removedIds.length) {
      const removed = await client.from('competition_roster_members').update({ is_current: false, status: 'removed', left_at: now, updated_at: now }).in('roster_member_id', removedIds)
      if (removed.error) return Response.json({ error: removed.error.message }, { status: 500 })
      counters.rosterArchived += removedIds.length
    }
  }

  const removedEntryIds = (currentEntries ?? []).filter((entry) => entry.source_registration_key && !sourceKeys.has(entry.source_registration_key)).map((entry) => entry.entry_id)
  if (removedEntryIds.length) {
    const archived = await client.from('competition_entries').update({ registration_status: 'withdrawn', competitive_status: 'inactive', status: 'withdrawn', left_at: now, updated_at: now }).in('entry_id', removedEntryIds)
    if (archived.error) return Response.json({ error: archived.error.message }, { status: 500 })
    counters.archived = removedEntryIds.length
  }

  const audit = await client.from('admin_audit_log').insert({
    admin_user_id: user.id, entity_type: 'competition_source', entity_id: String(source.competition_source_id),
    action: 'SOURCE APPLY', before_data: { snapshot_status: snapshotRow.status }, after_data: counters,
    reason: 'Reviewed Rivalry competition source apply', source_snapshot_id: snapshotId,
  })
  if (audit.error) return Response.json({ error: audit.error.message }, { status: 500 })

  await client.from('external_source_snapshots').update({ status: 'applied', applied_at: now, applied_by: user.id }).eq('snapshot_id', snapshotId)
  await client.from('competition_sources').update({ source_status: 'synced', last_synced_at: now, last_successful_sync_at: now, last_error: null, updated_at: now }).eq('competition_source_id', source.competition_source_id)
  return Response.json({ applied: true, counters })
}
