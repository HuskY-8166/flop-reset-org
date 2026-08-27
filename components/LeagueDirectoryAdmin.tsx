/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { normalizeLeagueIdentity, stableSourceKey } from '@/lib/leagueDirectory'
import { supabase } from '@/lib/supabase'

type Row = Record<string, any>
type Section = 'dashboard' | 'competitions' | 'teams' | 'players' | 'rosters' | 'sources' | 'identity' | 'pages' | 'audit'

const sections: Array<{ id: Section; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'competitions', label: 'Competitions' },
  { id: 'teams', label: 'League Teams' },
  { id: 'players', label: 'Players' },
  { id: 'rosters', label: 'Rosters' },
  { id: 'sources', label: 'Sources' },
  { id: 'identity', label: 'Identity' },
  { id: 'pages', label: 'Pages' },
  { id: 'audit', label: 'Audit Log' },
]

export function LeagueDirectoryAdmin() {
  const [section, setSection] = useState<Section>('dashboard')
  const [competitions, setCompetitions] = useState<Row[]>([])
  const [entries, setEntries] = useState<Row[]>([])
  const [players, setPlayers] = useState<Row[]>([])
  const [frPlayers, setFrPlayers] = useState<Row[]>([])
  const [frTeams, setFrTeams] = useState<Row[]>([])
  const [opponents, setOpponents] = useState<Row[]>([])
  const [rosters, setRosters] = useState<Row[]>([])
  const [sources, setSources] = useState<Row[]>([])
  const [reconciliation, setReconciliation] = useState<Row[]>([])
  const [pages, setPages] = useState<Row[]>([])
  const [audits, setAudits] = useState<Row[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState('')
  const [selectedEntry, setSelectedEntry] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [selectedRoster, setSelectedRoster] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourcePreview, setSourcePreview] = useState<Row | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [migrationReady, setMigrationReady] = useState(true)

  async function load() {
    setLoading(true)
    const results = await Promise.all([
      supabase.from('competitions').select('*').order('id'),
      supabase.from('competition_entries').select('*').order('display_name_snapshot'),
      supabase.from('league_players').select('*').order('canonical_name'),
      supabase.from('players').select('player_id, name').order('name'),
      supabase.from('teams').select('id, name, format').order('name'),
      supabase.from('opponents').select('*').order('canonical_name'),
      supabase.from('competition_roster_members').select('*').order('entry_id'),
      supabase.from('competition_sources').select('*').order('competition_id'),
      supabase.from('identity_reconciliation_queue').select('*').order('created_at', { ascending: false }),
      supabase.from('page_content_overrides').select('*').order('page_key'),
      supabase.from('admin_audit_log').select('*').order('occurred_at', { ascending: false }).limit(100),
    ])
    setCompetitions(results[0].data ?? [])
    const structuralError = results.slice(1).find((result) => result.error)?.error
    setMigrationReady(!structuralError)
    if (structuralError) setMessage(`League directory unavailable: ${structuralError.message}`)
    setEntries(results[1].data ?? [])
    setPlayers(results[2].data ?? [])
    setFrPlayers(results[3].data ?? [])
    setFrTeams(results[4].data ?? [])
    setOpponents(results[5].data ?? [])
    setRosters(results[6].data ?? [])
    setSources(results[7].data ?? [])
    setReconciliation(results[8].data ?? [])
    setPages(results[9].data ?? [])
    setAudits(results[10].data ?? [])
    setSelectedCompetition((value) => value || String(results[0].data?.[0]?.id ?? ''))
    setSelectedEntry((value) => value || String(results[1].data?.[0]?.entry_id ?? ''))
    setSelectedPlayer((value) => value || String(results[2].data?.[0]?.league_player_id ?? ''))
    setSelectedRoster((value) => value || String(results[6].data?.[0]?.roster_member_id ?? ''))
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const competition = competitions.find((row) => String(row.id) === selectedCompetition)
  const entry = entries.find((row) => String(row.entry_id) === selectedEntry)
  const player = players.find((row) => String(row.league_player_id) === selectedPlayer)
  const roster = rosters.find((row) => String(row.roster_member_id) === selectedRoster)
  const source = sources.find((row) => String(row.competition_id) === selectedCompetition)
  const unresolved = reconciliation.filter((row) => row.status === 'open')
  const dataHealth = useMemo(() => ({
    entries: entries.length,
    mappings: entries.filter((row) => row.fr_team_id || row.opponent_id).length,
    unresolved: entries.filter((row) => !row.fr_team_id && !row.opponent_id).length,
    duplicateSourceIds: entries.filter((row, index) => row.source_external_id && entries.findIndex((candidate) => candidate.source_provider === row.source_provider && candidate.source_external_id === row.source_external_id) !== index).length,
    rosterCoverage: entries.filter((row) => rosters.some((member) => member.entry_id === row.entry_id && member.is_current)).length,
    powerLinked: entries.filter((row) => row.is_power_tracked).length,
    tierCoverage: entries.filter((row) => row.tier).length,
    logoCoverage: entries.filter((row) => row.logo_url_snapshot).length,
    overrides: entries.filter((row) => Array.isArray(row.locked_fields) && row.locked_fields.length).length,
  }), [entries, rosters])

  async function audit(entityType: string, entityId: string | number, action: string, before: Row | null, after: Row | null, reason?: string) {
    const { data } = await supabase.auth.getUser()
    await supabase.from('admin_audit_log').insert({ admin_user_id: data.user?.id ?? null, entity_type: entityType, entity_id: String(entityId), action, before_data: before, after_data: after, reason: reason ?? null })
  }

  async function saveCompetition(formData: FormData) {
    if (!competition) return
    const patch = {
      league_name: text(formData, 'league_name'), circuit_name: text(formData, 'circuit_name'),
      season_year: numberOrNull(formData.get('season_year')), region: text(formData, 'region'),
      format: text(formData, 'format'), status: text(formData, 'status'), timezone: text(formData, 'timezone'),
      starts_at: text(formData, 'starts_at') || null, ends_at: text(formData, 'ends_at') || null,
    }
    const { error } = await supabase.from('competitions').update(patch).eq('id', competition.id)
    if (error) return setMessage(error.message)
    await audit('competition', competition.id, 'UPDATE', competition, patch)
    setMessage('Competition saved and audited.')
    await load()
  }

  async function saveEntry(formData: FormData) {
    if (!entry) return
    const locks = ['display_name_snapshot', 'logo_url_snapshot', 'tier'].filter((field) => formData.get(`lock_${field}`) === 'on')
    const frTeamId = numberOrNull(formData.get('fr_team_id'))
    const opponentId = numberOrNull(formData.get('opponent_id'))
    if (frTeamId && opponentId) return setMessage('An entry cannot be both an FR team and an external league team.')
    const sourceExternalId = text(formData, 'source_external_id')
    const sourceUrlValue = text(formData, 'source_url')
    let externalSourceId: number | null = null
    if (sourceExternalId) {
      const mapping = await supabase.from('external_team_sources').upsert({
        provider: 'rivalry', external_team_id: sourceExternalId,
        opponent_id: opponentId, source_url: sourceUrlValue || `https://therivalry.gg/teams/${sourceExternalId}`,
        source_display_name: text(formData, 'display_name_snapshot'), last_synced_at: new Date().toISOString(),
      }, { onConflict: 'provider,external_team_id' }).select().single()
      if (mapping.error || !mapping.data) return setMessage(mapping.error?.message ?? 'Source mapping could not be attached.')
      externalSourceId = Number(mapping.data.source_id)
    }
    const patch = {
      display_name_snapshot: text(formData, 'display_name_snapshot'), logo_url_snapshot: text(formData, 'logo_url_snapshot') || null,
      tier: text(formData, 'tier') || null, seed: numberOrNull(formData.get('seed')),
      registration_status: text(formData, 'registration_status'), competitive_status: text(formData, 'competitive_status'),
      is_power_tracked: formData.get('is_power_tracked') === 'on', status: text(formData, 'status'), notes: text(formData, 'notes') || null,
      fr_team_id: frTeamId, opponent_id: opponentId, locked_fields: locks, updated_at: new Date().toISOString(),
      external_source_id: externalSourceId, source_external_id: sourceExternalId || null,
      source_url: sourceUrlValue || null,
      manual_values: { ...(entry.manual_values ?? {}), display_name_snapshot: text(formData, 'display_name_snapshot'), logo_url_snapshot: text(formData, 'logo_url_snapshot') || null, tier: text(formData, 'tier') || null },
    }
    const { error } = await supabase.from('competition_entries').update(patch).eq('entry_id', entry.entry_id)
    if (error) return setMessage(error.message)
    await audit('competition_entry', entry.entry_id, locks.length ? 'MANUAL OVERRIDE' : 'UPDATE', entry, patch)
    setMessage('League team entry saved. Historical result snapshots were not rewritten.')
    await load()
  }

  async function useEntrySourceField(field: string) {
    if (!entry || !(field in (entry.source_values ?? {}))) return
    const nextLocks = (entry.locked_fields ?? []).filter((value: string) => value !== field)
    const patch = { [field]: entry.source_values[field], locked_fields: nextLocks, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('competition_entries').update(patch).eq('entry_id', entry.entry_id)
    if (error) return setMessage(error.message)
    await audit('competition_entry', entry.entry_id, 'UNLOCK', entry, patch, `Use source value for ${field}`)
    setMessage(`Source value accepted for ${field}.`)
    await load()
  }

  async function toggleEntryLock(field: string) {
    if (!entry) return
    const current = new Set<string>(entry.locked_fields ?? [])
    const action = current.has(field) ? 'UNLOCK' : 'LOCK'
    if (current.has(field)) current.delete(field); else current.add(field)
    const patch = { locked_fields: [...current], updated_at: new Date().toISOString() }
    const { error } = await supabase.from('competition_entries').update(patch).eq('entry_id', entry.entry_id)
    if (error) return setMessage(error.message)
    await audit('competition_entry', entry.entry_id, action, entry, patch, `${action} ${field}`)
    setMessage(`${field} ${action.toLocaleLowerCase('en-US')}ed.`)
    await load()
  }

  async function addAlias(formData: FormData) {
    if (!entry?.opponent_id) return setMessage('Attach a canonical external team before adding an alias.')
    const alias = text(formData, 'alias')
    if (!alias) return
    const { error } = await supabase.from('opponent_aliases').insert({ opponent_id: entry.opponent_id, alias, normalized_alias: normalizeLeagueIdentity(alias) })
    if (error) return setMessage(error.message)
    await audit('opponent', entry.opponent_id, 'ALIAS', null, { alias }, 'Confirmed Admin alias')
    setMessage('Alias added without rewriting historical series names.')
  }

  async function savePlayer(formData: FormData) {
    if (!player) return
    const patch = {
      canonical_name: text(formData, 'canonical_name'), display_name: text(formData, 'display_name') || null,
      normalized_name: normalizeLeagueIdentity(text(formData, 'canonical_name')), status: text(formData, 'status'),
      country: text(formData, 'country') || null, linked_fr_player_id: numberOrNull(formData.get('linked_fr_player_id')),
      aliases: text(formData, 'aliases').split(',').map((value) => value.trim()).filter(Boolean), notes: text(formData, 'notes') || null,
      locked_fields: formData.get('lock_canonical_name') === 'on' ? ['canonical_name'] : [], updated_at: new Date().toISOString(),
      manual_values: { ...(player.manual_values ?? {}), canonical_name: text(formData, 'canonical_name'), display_name: text(formData, 'display_name') || null },
    }
    const { error } = await supabase.from('league_players').update(patch).eq('league_player_id', player.league_player_id)
    if (error) return setMessage(error.message)
    await audit('league_player', player.league_player_id, 'UPDATE', player, patch)
    setMessage('League player saved; FR player history remains separate.')
    await load()
  }

  async function saveRoster(formData: FormData) {
    if (!roster) return
    const active = formData.get('is_current') === 'on'
    const patch = { display_name_snapshot: text(formData, 'display_name_snapshot'), role: text(formData, 'role'), status: active ? 'active' : 'removed', is_current: active, left_at: active ? null : new Date().toISOString(), updated_at: new Date().toISOString() }
    const { error } = await supabase.from('competition_roster_members').update(patch).eq('roster_member_id', roster.roster_member_id)
    if (error) return setMessage(error.message)
    await audit('competition_roster_member', roster.roster_member_id, 'ROSTER CHANGE', roster, patch)
    setMessage('Roster snapshot updated. Removed membership remains historical.')
    await load()
  }

  async function addRosterMember(formData: FormData) {
    const targetEntryId = numberOrNull(formData.get('entry_id'))
    const name = text(formData, 'display_name_snapshot')
    if (!targetEntryId || !name) return setMessage('Entry and player display name are required.')
    const linkedPlayerId = numberOrNull(formData.get('league_player_id'))
    const key = linkedPlayerId ? `league-player:${linkedPlayerId}` : `manual:${stableSourceKey([targetEntryId, name, Date.now()])}`
    const { data, error } = await supabase.from('competition_roster_members').insert({ entry_id: targetEntryId, league_player_id: linkedPlayerId, source_member_key: key, display_name_snapshot: name, role: text(formData, 'role'), source_provider: 'manual', joined_at: new Date().toISOString() }).select().single()
    if (error) return setMessage(error.message)
    await audit('competition_roster_member', data.roster_member_id, 'ROSTER CHANGE', null, data)
    setMessage('Roster member added as a new historical membership.')
    await load()
  }

  async function previewSource() {
    setMessage('Fetching public Rivalry source…')
    setSourcePreview(null)
    const { data } = await supabase.auth.getSession()
    const response = await fetch('/api/admin/league-source/preview', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: JSON.stringify({ competitionId: selectedCompetition, sourceUrl }) })
    const payload = await response.json()
    if (!response.ok) return setMessage(payload.error ?? 'Source preview failed.')
    setSourcePreview(payload)
    setMessage('Preview ready. Review every category before Apply Safe Changes.')
  }

  async function applySource() {
    if (!sourcePreview?.snapshotId || !confirm(`Apply reviewed snapshot ${sourcePreview.snapshotId}? Locked fields will remain authoritative; removals will be archived.`)) return
    const { data } = await supabase.auth.getSession()
    const response = await fetch('/api/admin/league-source/apply', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: JSON.stringify({ snapshotId: sourcePreview.snapshotId }) })
    const payload = await response.json()
    if (!response.ok) return setMessage(payload.error ?? 'Source apply failed.')
    setMessage(payload.idempotent ? payload.message : `Source applied: ${JSON.stringify(payload.counters)}`)
    setSourcePreview(null)
    await load()
  }

  async function resolveIdentity(row: Row, formData: FormData) {
    const patch = { status: text(formData, 'status'), resolution_notes: text(formData, 'resolution_notes'), resolved_at: new Date().toISOString() }
    const { data } = await supabase.auth.getUser()
    Object.assign(patch, { resolved_by: data.user?.id ?? null })
    const { error } = await supabase.from('identity_reconciliation_queue').update(patch).eq('reconciliation_id', row.reconciliation_id)
    if (error) return setMessage(error.message)
    await audit('identity_reconciliation', row.reconciliation_id, 'UPDATE', row, patch)
    setMessage('Identity issue updated. No canonical merge was performed automatically.')
    await load()
  }

  async function savePage(formData: FormData) {
    const pageKey = text(formData, 'page_key')
    if (!pageKey) return
    const patch = { page_key: pageKey, title_override: text(formData, 'title_override') || null, subtitle_override: text(formData, 'subtitle_override') || null, hero_image_url: text(formData, 'hero_image_url') || null, featured_content: text(formData, 'featured_content') || null, is_visible: formData.get('is_visible') === 'on', manual_callout: text(formData, 'manual_callout') || null, seo_title: text(formData, 'seo_title') || null, seo_description: text(formData, 'seo_description') || null, updated_at: new Date().toISOString() }
    const existing = pages.find((row) => row.page_key === pageKey) ?? null
    const { error } = await supabase.from('page_content_overrides').upsert(patch)
    if (error) return setMessage(error.message)
    await audit('page_content', pageKey, existing ? 'UPDATE' : 'CREATE', existing, patch)
    setMessage('Controlled page content saved. Computed statistics remain computed.')
    await load()
  }

  if (loading) return <div className="rounded-2xl border border-neutral-800 p-6 text-neutral-500">Loading league directory control plane…</div>
  if (!migrationReady) return <div className="rounded-2xl border border-amber-800 bg-amber-950/20 p-6"><div className="font-black text-amber-300">V2.3.9 SCHEMA PREPARED</div><p className="mt-2 text-sm text-amber-100/70">Apply the reviewed schema-only league-directory migration before using these editors. Existing public competition results remain readable.</p>{message && <p className="mt-3 text-xs text-amber-200">{message}</p>}</div>

  return <div className="min-w-0 space-y-6">
    <div className="max-w-full overflow-x-auto rounded-xl border border-neutral-800 bg-black/20 p-2"><div className="flex min-w-max gap-1">{sections.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`rounded-lg px-3 py-2 text-sm font-bold ${section === item.id ? 'bg-purple-700 text-white' : 'text-neutral-400 hover:bg-neutral-900'}`}>{item.label}</button>)}</div></div>
    {message && <div className="break-words rounded-xl border border-purple-900 bg-purple-950/20 p-3 text-sm text-purple-200">{message}</div>}
    {section === 'teams' && entry && <SourceEffective entry={entry} onUseSource={useEntrySourceField} onToggleLock={toggleEntryLock} />}

    {section === 'dashboard' && <section><Heading title="League Directory Data Health" description="Structural coverage only. Source counts are read from snapshots, never hardcoded." /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"><Metric label="Competition entries" value={dataHealth.entries} /><Metric label="Canonical mappings" value={dataHealth.mappings} /><Metric label="Unresolved" value={dataHealth.unresolved} /><Metric label="Duplicate source IDs" value={dataHealth.duplicateSourceIds} /><Metric label="Roster coverage" value={`${dataHealth.rosterCoverage}/${dataHealth.entries}`} /><Metric label="Power tracked" value={dataHealth.powerLinked} /><Metric label="Tier coverage" value={`${dataHealth.tierCoverage}/${dataHealth.entries}`} /><Metric label="Logo coverage" value={`${dataHealth.logoCoverage}/${dataHealth.entries}`} /><Metric label="Manual overrides" value={dataHealth.overrides} /><Metric label="Sync conflicts" value={unresolved.length} /></div><div className="mt-5 grid gap-3 md:grid-cols-2">{sources.map((row) => <div key={row.competition_source_id} className="rounded-xl border border-neutral-800 p-4"><div className="font-black">{competitions.find((item) => item.id === row.competition_id)?.name ?? `Competition ${row.competition_id}`}</div><div className="mt-1 text-xs text-neutral-500">{row.source_status} · last good {row.last_successful_sync_at ? new Date(row.last_successful_sync_at).toLocaleString() : 'never'} · {row.parser_version ?? 'parser pending'}</div></div>)}</div></section>}

    {section === 'competitions' && <section><Heading title="Competition Editor" description="League, circuit, region, format, dates, timezone, and source-facing metadata." /><EntitySelect label="Competition" value={selectedCompetition} onChange={setSelectedCompetition} rows={competitions} id="id" name="name" />{competition && <form action={saveCompetition} className="mt-5 grid gap-4 sm:grid-cols-2"><Field name="league_name" label="League" value={competition.league_name} /><Field name="circuit_name" label="Circuit" value={competition.circuit_name} /><Field name="season_year" label="Season year" value={competition.season_year} type="number" /><Field name="region" label="Region" value={competition.region} /><Field name="format" label="Format" value={competition.format} /><Field name="status" label="Status" value={competition.status} /><Field name="timezone" label="Timezone" value={competition.timezone} /><Field name="starts_at" label="Starts" value={dateInput(competition.starts_at)} type="datetime-local" /><Field name="ends_at" label="Ends" value={dateInput(competition.ends_at)} type="datetime-local" /><Submit label="Save competition" /></form>}</section>}

    {section === 'teams' && <section><Heading title="League Team Editor" description="Canonical identity and competition participation stay separate. Deactivation is soft." /><EntitySelect label="Competition entry" value={selectedEntry} onChange={setSelectedEntry} rows={entries} id="entry_id" name="display_name_snapshot" />{entry && <><form action={saveEntry} className="mt-5 grid gap-4 sm:grid-cols-2"><Field name="display_name_snapshot" label="Display name" value={entry.display_name_snapshot} /><Field name="logo_url_snapshot" label="Logo URL" value={entry.logo_url_snapshot} /><Field name="tier" label="Tier" value={entry.tier} /><Field name="seed" label="Seed" value={entry.seed} type="number" /><Select name="registration_status" label="Registration status" value={entry.registration_status} options={['registered', 'pending', 'withdrawn', 'inactive']} /><Select name="competitive_status" label="Competitive status" value={entry.competitive_status} options={['active', 'pending', 'inactive', 'withdrawn']} /><Select name="status" label="Archive state" value={entry.status} options={['active', 'inactive', 'archived', 'withdrawn']} /><Select name="fr_team_id" label="FR team identity" value={entry.fr_team_id} options={['', ...frTeams.map((row) => String(row.id))]} labels={['None', ...frTeams.map((row) => `${row.name} · ${row.format}`)]} /><Select name="opponent_id" label="Canonical league team" value={entry.opponent_id} options={['', ...opponents.map((row) => String(row.opponent_id))]} labels={['Unresolved', ...opponents.map((row) => row.canonical_name)]} /><Field name="source_external_id" label="Rivalry stable team ID" value={entry.source_external_id} /><Field name="source_url" label="Source URL" value={entry.source_url} /><Field name="notes" label="Notes" value={entry.notes} /><Check name="is_power_tracked" label="Power tracked" checked={entry.is_power_tracked} /><Check name="lock_display_name_snapshot" label="Lock manual display name" checked={entry.locked_fields?.includes('display_name_snapshot')} /><Check name="lock_logo_url_snapshot" label="Lock manual logo" checked={entry.locked_fields?.includes('logo_url_snapshot')} /><Check name="lock_tier" label="Lock manual tier" checked={entry.locked_fields?.includes('tier')} /><Submit label="Save / attach source" /></form><p className="mt-3 text-xs text-neutral-600">Clear the stable team ID and save to detach this entry from the source mapping without deleting the mapping or history.</p><form action={addAlias} className="mt-6 flex min-w-0 flex-col gap-3 rounded-xl border border-neutral-800 p-4 sm:flex-row sm:items-end"><Field name="alias" label="Confirmed alias" value="" /><Submit label="Add alias" /></form></>}</section>}

    {section === 'players' && <section><Heading title="Player Editor" description="League players remain separate from FR players until an explicit identity link is confirmed." /><EntitySelect label="League player" value={selectedPlayer} onChange={setSelectedPlayer} rows={players} id="league_player_id" name="canonical_name" />{player && <form action={savePlayer} className="mt-5 grid gap-4 sm:grid-cols-2"><Field name="canonical_name" label="Canonical name" value={player.canonical_name} /><Field name="display_name" label="Display name" value={player.display_name} /><Field name="aliases" label="Aliases, comma separated" value={(player.aliases ?? []).join(', ')} /><Select name="status" label="Status" value={player.status} options={['active', 'inactive', 'archived']} /><Field name="country" label="Country" value={player.country} /><Select name="linked_fr_player_id" label="Linked FR player" value={player.linked_fr_player_id} options={['', ...frPlayers.map((row) => String(row.player_id))]} labels={['Not linked', ...frPlayers.map((row) => row.name)]} /><Field name="notes" label="Notes" value={player.notes} /><Check name="lock_canonical_name" label="Lock canonical name" checked={player.locked_fields?.includes('canonical_name')} /><Submit label="Save league player" /></form>}</section>}

    {section === 'rosters' && <section><Heading title="Roster Editor" description="Current membership can close, but historical event membership is never deleted." /><EntitySelect label="Roster membership" value={selectedRoster} onChange={setSelectedRoster} rows={rosters} id="roster_member_id" name="display_name_snapshot" />{roster && <form action={saveRoster} className="mt-5 grid gap-4 sm:grid-cols-2"><Field name="display_name_snapshot" label="Display snapshot" value={roster.display_name_snapshot} /><Select name="role" label="Role" value={roster.role} options={['player', 'captain', 'manager']} /><Check name="is_current" label="Current membership" checked={roster.is_current} /><Submit label="Save membership" /></form>}<form action={addRosterMember} className="mt-8 grid gap-4 rounded-2xl border border-neutral-800 p-5 sm:grid-cols-2"><Select name="entry_id" label="Competition entry" value={entry?.entry_id} options={entries.map((row) => String(row.entry_id))} labels={entries.map((row) => row.display_name_snapshot)} /><Select name="league_player_id" label="Known league player" value="" options={['', ...players.map((row) => String(row.league_player_id))]} labels={['Snapshot only', ...players.map((row) => row.canonical_name)]} /><Field name="display_name_snapshot" label="Player display snapshot" value="" /><Select name="role" label="Role" value="player" options={['player', 'captain', 'manager']} /><Submit label="Add roster membership" /></form></section>}

    {section === 'sources' && <section><Heading title="Rivalry Source Sync" description="Fetch → parse → validate → preview → reconcile → apply. Public pages use the last good database snapshot." /><EntitySelect label="Competition" value={selectedCompetition} onChange={(value) => { setSelectedCompetition(value); setSourcePreview(null); setSourceUrl(sources.find((row) => String(row.competition_id) === value)?.source_url ?? '') }} rows={competitions} id="id" name="name" /><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"><Field name="source_url" label="Rivalry source URL" value={sourceUrl || source?.source_url || ''} onChange={setSourceUrl} /><button type="button" onClick={previewSource} className="min-h-11 self-end rounded-lg bg-purple-700 px-5 font-black text-white">Preview Sync</button></div>{source && <div className="mt-4 rounded-xl border border-neutral-800 p-4 text-xs text-neutral-400"><div>External competition ID: {source.external_competition_id}</div><div>Source status: {source.source_status}</div><div>Last successful sync: {source.last_successful_sync_at ? new Date(source.last_successful_sync_at).toLocaleString() : 'Never'}</div><div>Parser: {source.parser_version ?? 'Pending'}</div>{source.last_error && <div className="mt-2 text-red-300">Source error: {source.last_error}</div>}</div>}{sourcePreview && <div className="mt-6 space-y-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="New teams" value={sourcePreview.preview.newTeams.length} /><Metric label="Changed" value={sourcePreview.preview.changedTeams.length} /><Metric label="Removed" value={sourcePreview.preview.removedTeams.length} /><Metric label="Possible duplicates" value={sourcePreview.preview.possibleDuplicates.length} /><Metric label="Locked conflicts" value={sourcePreview.preview.lockedConflicts.length} /><Metric label="Source entries" value={sourcePreview.preview.sourceCount} /><Metric label="FR entries" value={sourcePreview.preview.currentCount} /><Metric label="Roster members" value={sourcePreview.snapshot.entries.reduce((sum: number, row: Row) => sum + row.roster.length, 0)} /></div><div className="rounded-xl border border-cyan-900/60 bg-cyan-950/10 p-4"><div className="font-black text-cyan-300">Reconciliation Report</div><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{Object.entries(sourcePreview.reconciliation ?? {}).map(([label, value]) => <Metric key={label} label={label.replace(/([A-Z])/g, ' $1')} value={String(value)} />)}</div></div><PreviewList title="New teams" rows={sourcePreview.preview.newTeams.map((row: Row) => row.displayName)} /><PreviewList title="Changed teams" rows={sourcePreview.preview.changedTeams.map((row: Row) => `${row.existing.display_name_snapshot}: ${row.fields.join(', ')}`)} /><PreviewList title="Removed registrations" rows={sourcePreview.preview.removedTeams.map((row: Row) => row.display_name_snapshot)} /><PreviewList title="Identity review" rows={sourcePreview.preview.possibleDuplicates.map((row: Row) => `${row.source.displayName} may duplicate ${row.candidates.map((candidate: Row) => candidate.display_name_snapshot).join(', ')}`)} /><div className="flex flex-wrap gap-3"><button type="button" onClick={applySource} className="rounded-lg bg-emerald-700 px-5 py-3 font-black text-white">Apply Safe Changes</button><a href={sourcePreview.snapshot.sourceUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-neutral-700 px-5 py-3 font-bold text-neutral-300 no-underline">View Source</a></div></div>}</section>}

    {section === 'identity' && <section><Heading title="Identity Reconciliation" description="Same-name and uncertain source identities require an Admin decision; nothing here auto-merges." />{reconciliation.length ? <div className="space-y-3">{reconciliation.map((row) => <form key={row.reconciliation_id} action={(formData) => resolveIdentity(row, formData)} className="rounded-xl border border-neutral-800 p-4"><div className="font-black">{row.source_display_name}</div><div className="mt-1 text-xs text-neutral-500">{row.issue_type} · {row.source_provider ?? 'manual'} · {row.status}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Select name="status" label="Review status" value={row.status} options={['open', 'resolved', 'dismissed']} /><Field name="resolution_notes" label="Resolution notes" value={row.resolution_notes} /><Submit label="Save review" /></div></form>)}</div> : <EmptyAdmin text="No identity issues are queued." />}</section>}

    {section === 'pages' && <section><Heading title="Controlled Page Content" description="Titles, descriptions, images, visibility, notes, and SEO only. Computed Power and records remain read-only." /><form action={savePage} className="grid gap-4 sm:grid-cols-2"><Field name="page_key" label="Page key" value="league-directory" /><Field name="title_override" label="Title override" value="" /><Field name="subtitle_override" label="Subtitle" value="" /><Field name="hero_image_url" label="Hero image URL" value="" /><Field name="featured_content" label="Featured content" value="" /><Field name="manual_callout" label="Manual callout" value="" /><Field name="seo_title" label="SEO title" value="" /><Field name="seo_description" label="SEO description" value="" /><Check name="is_visible" label="Publicly visible" checked /><Submit label="Save page content" /></form>{pages.length ? <div className="mt-6 space-y-2">{pages.map((row) => <div key={row.page_key} className="rounded-lg border border-neutral-800 p-3 text-sm"><span className="font-bold">{row.page_key}</span> · {row.is_visible ? 'visible' : 'hidden'}</div>)}</div> : null}</section>}

    {section === 'audit' && <section><Heading title="Admin Audit Log" description="Meaningful changes, source applies, locks, aliases, and roster history." />{audits.length ? <div className="max-w-full overflow-x-auto rounded-xl border border-neutral-800"><table className="min-w-[760px] text-sm"><thead><tr className="text-left text-neutral-500"><th className="p-3">When</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Reason</th></tr></thead><tbody>{audits.map((row) => <tr key={row.audit_id} className="border-t border-neutral-800"><td className="p-3">{new Date(row.occurred_at).toLocaleString()}</td><td className="p-3 font-black text-purple-300">{row.action}</td><td className="p-3">{row.entity_type} #{row.entity_id}</td><td className="p-3 text-neutral-500">{row.reason ?? '—'}</td></tr>)}</tbody></table></div> : <EmptyAdmin text="No V2.3.9 audit events yet." />}</section>}
    {section === 'sources' && sourcePreview && <section className="mt-6 rounded-2xl border border-neutral-800 p-5"><Heading title="Roster Diff" description="Player joins, role/name changes, and departures detected across changed and newly discovered registrations." /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Metric label="Roster joins" value={sourcePreview.preview.newRosterMembers.length} /><Metric label="Roster changes" value={sourcePreview.preview.changedRosterMembers.length} /><Metric label="Roster departures" value={sourcePreview.preview.removedRosterMembers.length} /></div><div className="mt-4 space-y-3"><PreviewList title="New roster members" rows={sourcePreview.preview.newRosterMembers.map((row: Row) => `${row.teamName}: ${row.member.displayName} (${row.member.role})`)} /><PreviewList title="Changed roster members" rows={sourcePreview.preview.changedRosterMembers.map((row: Row) => `${row.teamName}: ${row.existing.display_name_snapshot} — ${row.fields.join(', ')}`)} /><PreviewList title="Removed roster members" rows={sourcePreview.preview.removedRosterMembers.map((row: Row) => `${row.teamName}: ${row.member.display_name_snapshot}`)} /></div></section>}
  </div>
}

function text(form: FormData, name: string) { return String(form.get(name) ?? '').trim() }
function numberOrNull(value: FormDataEntryValue | null) { const parsed = Number(value); return value === null || value === '' || !Number.isFinite(parsed) ? null : parsed }
function dateInput(value: unknown) { return value ? String(value).slice(0, 16) : '' }
function Heading({ title, description }: { title: string; description: string }) { return <div className="mb-5"><div className="text-xs font-black uppercase tracking-[.2em] text-purple-400">V2.3.9 Control Plane</div><h2 className="mt-1 text-2xl font-black">{title}</h2><p className="mt-2 text-sm text-neutral-500">{description}</p></div> }
function Metric({ label, value }: { label: string; value: React.ReactNode }) { return <div className="min-w-0 rounded-xl border border-neutral-800 bg-black/20 p-3"><div className="break-words text-xs text-neutral-500">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div> }
function EntitySelect({ label, value, onChange, rows, id, name }: { label: string; value: string; onChange: (value: string) => void; rows: Row[]; id: string; name: string }) { return <label className="block min-w-0 text-xs font-bold uppercase tracking-wide text-neutral-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-neutral-700 bg-[#181818] px-3 text-white">{rows.map((row) => <option key={row[id]} value={row[id]}>{row[name]}</option>)}</select></label> }
function Field({ name, label, value, type = 'text', onChange }: { name: string; label: string; value: unknown; type?: string; onChange?: (value: string) => void }) { return <label className="block min-w-0 flex-1 text-xs font-bold uppercase tracking-wide text-neutral-500">{label}<input name={name} type={type} defaultValue={String(value ?? '')} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-neutral-700 bg-[#181818] px-3 text-white" /></label> }
function Select({ name, label, value, options, labels }: { name: string; label: string; value: unknown; options: string[]; labels?: string[] }) { return <label className="block min-w-0 text-xs font-bold uppercase tracking-wide text-neutral-500">{label}<select name={name} defaultValue={String(value ?? '')} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-neutral-700 bg-[#181818] px-3 text-white">{options.map((option, index) => <option key={`${name}-${option}`} value={option}>{labels?.[index] ?? option}</option>)}</select></label> }
function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) { return <label className="flex min-h-11 items-center gap-3 rounded-lg border border-neutral-800 px-3 text-sm text-neutral-300"><input name={name} type="checkbox" defaultChecked={checked} />{label}</label> }
function Submit({ label }: { label: string }) { return <button className="min-h-11 self-end rounded-lg bg-purple-700 px-5 font-black text-white hover:bg-purple-600">{label}</button> }
function PreviewList({ title, rows }: { title: string; rows: string[] }) { return <div className="rounded-xl border border-neutral-800 p-4"><div className="font-black">{title}</div>{rows.length ? <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-neutral-400">{rows.map((row, index) => <li key={`${row}-${index}`}>{row}</li>)}</ul> : <div className="mt-2 text-sm text-neutral-600">None</div>}</div> }
function EmptyAdmin({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-sm text-neutral-500">{text}</div> }

function SourceEffective({ entry, onUseSource, onToggleLock }: { entry: Row; onUseSource: (field: string) => void; onToggleLock: (field: string) => void }) {
  const fields = ['display_name_snapshot', 'logo_url_snapshot', 'tier']
  const locks = new Set<string>(entry.locked_fields ?? [])
  return <section className="rounded-2xl border border-cyan-900/60 bg-cyan-950/10 p-4"><div className="font-black text-cyan-300">Source Value vs Effective Value</div><div className="mt-4 space-y-3">{fields.map((field) => {
    const source = entry.source_values?.[field] ?? null
    const effective = entry[field] ?? null
    const isLocked = locks.has(field)
    const differs = String(source ?? '') !== String(effective ?? '')
    const status = isLocked ? 'Overridden' : differs ? 'Conflict' : 'Synced'
    return <div key={field} className="grid min-w-0 gap-3 rounded-xl border border-neutral-800 bg-black/20 p-3 sm:grid-cols-[1fr_1fr_auto]"><div className="min-w-0"><div className="text-[10px] font-black uppercase text-neutral-600">Source · {field}</div><div className="mt-1 break-words text-sm text-neutral-300">{String(source ?? '—')}</div></div><div className="min-w-0"><div className="text-[10px] font-black uppercase text-neutral-600">Effective · {status}</div><div className="mt-1 break-words text-sm text-white">{String(effective ?? '—')}</div></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => onUseSource(field)} disabled={source === null} className="rounded-lg border border-cyan-800 px-3 py-2 text-xs font-bold text-cyan-300 disabled:opacity-40">Use source</button><button type="button" onClick={() => onToggleLock(field)} className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-300">{isLocked ? 'Unlock field' : 'Keep FR override'}</button></div></div>
  })}</div></section>
}

export function LeagueDirectoryHealth() {
  const [health, setHealth] = useState<Row | null>(null)
  useEffect(() => {
    Promise.all([
      supabase.from('competition_entries').select('entry_id, fr_team_id, opponent_id, tier, logo_url_snapshot, is_power_tracked, locked_fields'),
      supabase.from('external_team_sources').select('source_id, provider, external_team_id'),
      supabase.from('competition_roster_members').select('entry_id, is_current'),
      supabase.from('competition_sources').select('competition_source_id, source_status, last_successful_sync_at'),
      supabase.from('identity_reconciliation_queue').select('reconciliation_id, status'),
    ]).then(([entryResult, mappingResult, rosterResult, sourceResult, queueResult]) => {
      const error = [entryResult, mappingResult, rosterResult, sourceResult, queueResult].find((result) => result.error)?.error
      if (error) return setHealth({ error: error.message })
      const entries = entryResult.data ?? []
      const currentRosterEntries = new Set((rosterResult.data ?? []).filter((row) => row.is_current).map((row) => row.entry_id))
      setHealth({
        entries: entries.length,
        mappings: mappingResult.data?.length ?? 0,
        unresolved: entries.filter((row) => !row.fr_team_id && !row.opponent_id).length,
        rosterCoverage: currentRosterEntries.size,
        power: entries.filter((row) => row.is_power_tracked).length,
        tiers: entries.filter((row) => row.tier).length,
        logos: entries.filter((row) => row.logo_url_snapshot).length,
        overrides: entries.filter((row) => Array.isArray(row.locked_fields) && row.locked_fields.length).length,
        conflicts: (queueResult.data ?? []).filter((row) => row.status === 'open').length,
        staleSources: (sourceResult.data ?? []).filter((row) => !row.last_successful_sync_at || row.source_status === 'error').length,
      })
    })
  }, [])
  if (!health) return <section className="rounded-2xl border border-neutral-800 p-5 text-sm text-neutral-500">Checking League Directory health…</section>
  if (health.error) return <section className="rounded-2xl border border-amber-800 bg-amber-950/15 p-5"><div className="font-black text-amber-300">LEAGUE DIRECTORY MIGRATION PENDING</div><p className="mt-2 text-xs text-amber-100/70">{health.error}</p></section>
  return <section className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-5"><div className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">League Directory</div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{[
    ['Competition entries', health.entries], ['External mappings', health.mappings], ['Unresolved identities', health.unresolved],
    ['Roster coverage', `${health.rosterCoverage}/${health.entries}`], ['Power linkage', health.power], ['Tier coverage', `${health.tiers}/${health.entries}`],
    ['Logo coverage', `${health.logos}/${health.entries}`], ['Manual overrides', health.overrides], ['Sync conflicts', health.conflicts], ['Stale/error sources', health.staleSources],
  ].map(([label, value]) => <Metric key={String(label)} label={String(label)} value={value} />)}</div></section>
}
