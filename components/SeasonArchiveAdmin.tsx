/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Row = Record<string, any>

const STATUS_OPTIONS = ['upcoming', 'active', 'completed', 'archived']
const RECIPIENT_OPTIONS = ['player', 'team', 'organization']
const METHOD_OPTIONS = ['admin', 'committee', 'statistical']

export function SeasonArchiveAdmin() {
  const [seasons, setSeasons] = useState<Row[]>([])
  const [competitions, setCompetitions] = useState<Row[]>([])
  const [entries, setEntries] = useState<Row[]>([])
  const [players, setPlayers] = useState<Row[]>([])
  const [teams, setTeams] = useState<Row[]>([])
  const [awards, setAwards] = useState<Row[]>([])
  const [seasonId, setSeasonId] = useState('')
  const [competitionId, setCompetitionId] = useState('')
  const [entryId, setEntryId] = useState('')
  const [recipientType, setRecipientType] = useState('player')
  const [loading, setLoading] = useState(true)
  const [schemaError, setSchemaError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true)
    const results = await Promise.all([
      supabase.from('competition_seasons').select('*').order('season_year', { ascending: false }).order('display_order'),
      supabase.from('competitions').select('id, name, format, league_name, circuit_name, season_year, season_id').order('id'),
      supabase.from('competition_entries').select('entry_id, competition_id, display_name_snapshot, regular_season_finish, final_placement, placement_label').order('display_name_snapshot'),
      supabase.from('players').select('player_id, name').order('name'),
      supabase.from('teams').select('id, name, display_name, format').order('name'),
      supabase.from('season_awards').select('*').order('created_at', { ascending: false }),
    ])

    const archiveError = [results[0], results[1], results[2], results[5]].find((result) => result.error)?.error
    setSchemaError(archiveError?.message ?? '')
    setSeasons(results[0].data ?? [])
    setCompetitions(results[1].data ?? [])
    setEntries(results[2].data ?? [])
    setPlayers(results[3].data ?? [])
    setTeams(results[4].data ?? [])
    setAwards(results[5].data ?? [])
    setSeasonId((value) => value || String(results[0].data?.[0]?.season_id ?? ''))
    setCompetitionId((value) => value || String(results[1].data?.[0]?.id ?? ''))
    setEntryId((value) => value || String(results[2].data?.[0]?.entry_id ?? ''))
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const season = seasons.find((row) => String(row.season_id) === seasonId)
  const competition = competitions.find((row) => String(row.id) === competitionId)
  const entry = entries.find((row) => String(row.entry_id) === entryId)
  const seasonAwards = awards.filter((row) => String(row.season_id) === seasonId)

  async function audit(entityType: string, entityId: string | number, action: string, before: Row | null, after: Row | null, reason: string) {
    const { data } = await supabase.auth.getUser()
    await supabase.from('admin_audit_log').insert({
      admin_user_id: data.user?.id ?? null,
      entity_type: entityType,
      entity_id: String(entityId),
      action,
      before_data: before,
      after_data: after,
      reason,
    })
  }

  async function saveSeason(formData: FormData) {
    if (!season) return
    const patch = {
      status: text(formData, 'status'),
      starts_at: nullableText(formData, 'starts_at'),
      ends_at: nullableText(formData, 'ends_at'),
      summary: nullableText(formData, 'summary'),
      hero_image_url: nullableText(formData, 'hero_image_url'),
      display_order: numberOrZero(formData.get('display_order')),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('competition_seasons').update(patch).eq('season_id', season.season_id)
    if (error) return setMessage(error.message)
    await audit('competition_season', season.season_id, 'UPDATE', season, patch, 'Season archive metadata updated')
    setMessage('Season archive metadata saved and audited.')
    await load()
  }

  async function attachCompetition(formData: FormData) {
    if (!competition) return
    const nextSeasonId = numberOrNull(formData.get('season_id'))
    const patch = { season_id: nextSeasonId }
    const { error } = await supabase.from('competitions').update(patch).eq('id', competition.id)
    if (error) return setMessage(error.message)
    await audit('competition', competition.id, 'ARCHIVE ATTACHMENT', competition, patch, 'Competition season attachment updated')
    setMessage(nextSeasonId ? 'Competition attached to the selected season.' : 'Competition left unassigned for reconciliation.')
    await load()
  }

  async function savePlacement(formData: FormData) {
    if (!entry) return
    const patch = {
      regular_season_finish: positiveNumberOrNull(formData.get('regular_season_finish')),
      final_placement: positiveNumberOrNull(formData.get('final_placement')),
      placement_label: nullableText(formData, 'placement_label'),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('competition_entries').update(patch).eq('entry_id', entry.entry_id)
    if (error) return setMessage(error.message)
    await audit('competition_entry', entry.entry_id, 'PLACEMENT UPDATE', entry, patch, 'Verified season placement updated')
    setMessage('Placement saved. No match or standings data was rewritten.')
    await load()
  }

  async function createAward(formData: FormData) {
    if (!season) return
    const playerId = recipientType === 'player' ? numberOrNull(formData.get('player_id')) : null
    const teamId = recipientType === 'team' ? numberOrNull(formData.get('team_id')) : null
    if (recipientType === 'player' && !playerId) return setMessage('Select a player recipient.')
    if (recipientType === 'team' && !teamId) return setMessage('Select a team recipient.')

    const evidenceText = text(formData, 'evidence')
    let evidence: Row = {}
    if (evidenceText) {
      try {
        evidence = JSON.parse(evidenceText)
      } catch {
        return setMessage('Evidence must be valid JSON, or left blank.')
      }
    }

    const insert = {
      season_id: season.season_id,
      competition_id: numberOrNull(formData.get('competition_id')),
      award_type: text(formData, 'award_type'),
      title: text(formData, 'title'),
      recipient_type: recipientType,
      player_id: playerId,
      team_id: teamId,
      selection_method: text(formData, 'selection_method'),
      supporting_notes: nullableText(formData, 'supporting_notes'),
      evidence,
      is_public: false,
      approved_at: null,
      approved_by: null,
    }
    if (!insert.award_type || !insert.title) return setMessage('Award type and public title are required.')
    const { data, error } = await supabase.from('season_awards').insert(insert).select().single()
    if (error || !data) return setMessage(error?.message ?? 'Award draft could not be created.')
    await audit('season_award', data.award_id, 'CREATE DRAFT', null, data, 'Season award created as private draft')
    setMessage('Private award draft created. It will not appear publicly until approved.')
    await load()
  }

  async function setAwardPublication(award: Row, publish: boolean) {
    const { data: auth } = await supabase.auth.getUser()
    const patch = publish
      ? { is_public: true, approved_at: new Date().toISOString(), approved_by: auth.user?.id ?? null, updated_at: new Date().toISOString() }
      : { is_public: false, approved_at: null, approved_by: null, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('season_awards').update(patch).eq('award_id', award.award_id)
    if (error) return setMessage(error.message)
    await audit('season_award', award.award_id, publish ? 'APPROVE' : 'UNPUBLISH', award, patch, publish ? 'Award explicitly approved for archive' : 'Award removed from public archive')
    setMessage(publish ? 'Award approved and published.' : 'Award returned to private draft status.')
    await load()
  }

  if (loading) return <AdminNotice title="Archive control plane" text="Loading season archive data…" />
  if (schemaError) return <AdminNotice title="Archive migration pending" text={`Apply the reviewed V2.4 archive foundation migration in a non-production environment first. No fallback writes are attempted. ${schemaError}`} warning />

  return <div className="space-y-8">
    <header>
      <div className="text-xs font-black uppercase tracking-[.2em] text-purple-400">V2.4 Archive Control Plane</div>
      <h2 className="mt-1 text-2xl font-black text-white">Seasons, Placements & Awards</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">Only enter verified historical facts. Saving archive metadata never recalculates results, rewrites roster history, or invents standings.</p>
      {message && <div role="status" className="mt-4 rounded-xl border border-cyan-900/60 bg-cyan-950/15 p-3 text-sm text-cyan-200">{message}</div>}
    </header>

    <section className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6">
      <Heading title="Season archive" text="Set the permanent season status and editorial context." />
      <EntitySelect label="Season" value={seasonId} onChange={setSeasonId} rows={seasons} id="season_id" getLabel={(row) => `${row.league_name} — ${row.season_name} ${row.season_year}`} />
      {season && <form key={season.season_id} action={saveSeason} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
        <Select name="status" label="Archive status" value={season.status} options={STATUS_OPTIONS} />
        <Field name="display_order" label="Display order" value={season.display_order} type="number" />
        <Field name="starts_at" label="Starts" value={dateInput(season.starts_at)} type="datetime-local" />
        <Field name="ends_at" label="Ends" value={dateInput(season.ends_at)} type="datetime-local" />
        <Field name="hero_image_url" label="Hero image URL" value={season.hero_image_url} />
        <div className="sm:col-span-2"><TextArea name="summary" label="Archive summary" value={season.summary} /></div>
        <Submit label="Save season" />
        <Link href={`/competitions/archive/${season.slug}`} className="self-end rounded-lg border border-neutral-700 px-5 py-3 text-center text-sm font-bold text-neutral-300 no-underline hover:border-purple-600">View public archive</Link>
      </form>}
    </section>

    <section className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6">
      <Heading title="Competition attachment" text="Attach each format-specific competition to its permanent season. Leave ambiguous rows unassigned." />
      <EntitySelect label="Competition" value={competitionId} onChange={setCompetitionId} rows={competitions} id="id" getLabel={competitionLabel} />
      {competition && <form key={competition.id} action={attachCompetition} className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
        <Select name="season_id" label="Permanent season" value={competition.season_id} options={['', ...seasons.map((row) => String(row.season_id))]} labels={['Unassigned — needs reconciliation', ...seasons.map((row) => `${row.league_name} — ${row.season_name} ${row.season_year}`)]} />
        <Submit label="Save attachment" />
      </form>}
    </section>

    <section className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6">
      <Heading title="Verified placements" text="Record official finishes without deriving them from incomplete bracket or standings data." />
      <EntitySelect label="Competition entry" value={entryId} onChange={setEntryId} rows={entries} id="entry_id" getLabel={(row) => `${competitionLabel(competitions.find((item) => item.id === row.competition_id) ?? {})} — ${row.display_name_snapshot}`} />
      {entry && <form key={entry.entry_id} action={savePlacement} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
        <Field name="regular_season_finish" label="Regular-season finish" value={entry.regular_season_finish} type="number" min="1" />
        <Field name="final_placement" label="Final placement" value={entry.final_placement} type="number" min="1" />
        <Field name="placement_label" label="Placement label" value={entry.placement_label} placeholder="e.g. Quarterfinalist" />
        <Submit label="Save placement" />
      </form>}
    </section>

    <section className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6">
      <Heading title="Season awards" text="Create a private draft first. Publication always requires a separate explicit approval." />
      {season ? <form key={`award-${season.season_id}-${recipientType}`} action={createAward} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field name="award_type" label="Stable award type" value="" placeholder="season_mvp" />
        <Field name="title" label="Public title" value="" placeholder="Season MVP" />
        <Select name="competition_id" label="Format scope" value="" options={['', ...competitions.filter((row) => String(row.season_id) === seasonId).map((row) => String(row.id))]} labels={['Whole season', ...competitions.filter((row) => String(row.season_id) === seasonId).map(competitionLabel)]} />
        <label className="block min-w-0 text-xs font-bold uppercase tracking-wide text-neutral-500">Recipient type<select value={recipientType} onChange={(event) => setRecipientType(event.target.value)} className={inputClass}>{RECIPIENT_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
        {recipientType === 'player' && <Select name="player_id" label="Player" value="" options={['', ...players.map((row) => String(row.player_id))]} labels={['Select player', ...players.map((row) => row.name)]} />}
        {recipientType === 'team' && <Select name="team_id" label="Team" value="" options={['', ...teams.map((row) => String(row.id))]} labels={['Select team', ...teams.map((row) => `${row.display_name ?? row.name} · ${row.format}`)]} />}
        {recipientType === 'organization' && <div className="rounded-lg border border-neutral-800 p-3 text-sm text-neutral-400">Recipient: Flop Reset organization</div>}
        <Select name="selection_method" label="Selection method" value="admin" options={METHOD_OPTIONS} />
        <TextArea name="supporting_notes" label="Supporting notes" value="" />
        <TextArea name="evidence" label="Evidence JSON" value="" placeholder={'{"source":"official announcement"}'} />
        <Submit label="Create private draft" />
      </form> : <div className="text-sm text-neutral-500">Select a season before creating awards.</div>}

      <div className="mt-7 space-y-3">
        {seasonAwards.length === 0 && <div className="rounded-xl border border-dashed border-neutral-800 p-5 text-sm text-neutral-500">No awards recorded for this season.</div>}
        {seasonAwards.map((award) => <article key={award.award_id} className="flex min-w-0 flex-col gap-4 rounded-xl border border-neutral-800 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="break-words font-black text-white">{award.title}</div>
            <div className="mt-1 break-words text-xs text-neutral-500">{award.award_type} · {recipientName(award, players, teams)} · {award.selection_method}</div>
            <div className={`mt-2 text-xs font-black uppercase ${award.is_public ? 'text-emerald-400' : 'text-amber-400'}`}>{award.is_public ? 'Published' : 'Private draft'}</div>
          </div>
          <button type="button" onClick={() => void setAwardPublication(award, !award.is_public)} className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-black ${award.is_public ? 'border border-neutral-700 text-neutral-300' : 'bg-emerald-700 text-white hover:bg-emerald-600'}`}>{award.is_public ? 'Unpublish' : 'Approve & publish'}</button>
        </article>)}
      </div>
    </section>
  </div>
}

function competitionLabel(row: Row) {
  const identity = [row.league_name, row.circuit_name, row.season_year].filter(Boolean).join(' · ')
  return `${identity || row.name || 'Unidentified competition'}${row.format ? ` · ${row.format}` : ''}`
}

function recipientName(award: Row, players: Row[], teams: Row[]) {
  if (award.recipient_type === 'organization') return 'Flop Reset'
  if (award.recipient_type === 'player') return players.find((row) => row.player_id === award.player_id)?.name ?? `Player #${award.player_id}`
  const team = teams.find((row) => row.id === award.team_id)
  return team?.display_name ?? team?.name ?? `Team #${award.team_id}`
}

function text(form: FormData, name: string) { return String(form.get(name) ?? '').trim() }
function nullableText(form: FormData, name: string) { return text(form, name) || null }
function numberOrNull(value: FormDataEntryValue | null) { const parsed = Number(value); return value === null || value === '' || !Number.isFinite(parsed) ? null : parsed }
function positiveNumberOrNull(value: FormDataEntryValue | null) { const parsed = numberOrNull(value); return parsed !== null && parsed > 0 ? parsed : null }
function numberOrZero(value: FormDataEntryValue | null) { return numberOrNull(value) ?? 0 }
function dateInput(value: unknown) { return value ? String(value).slice(0, 16) : '' }

const inputClass = 'mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-neutral-700 bg-[#181818] px-3 text-white'

function Heading({ title, text }: { title: string; text: string }) { return <div className="mb-5"><h3 className="text-xl font-black text-white">{title}</h3><p className="mt-1 text-sm leading-6 text-neutral-500">{text}</p></div> }
function AdminNotice({ title, text, warning = false }: { title: string; text: string; warning?: boolean }) { return <section className={`rounded-2xl border p-5 ${warning ? 'border-amber-800 bg-amber-950/15' : 'border-neutral-800 bg-neutral-950/50'}`}><div className={`font-black uppercase tracking-wide ${warning ? 'text-amber-300' : 'text-purple-300'}`}>{title}</div><p className="mt-2 break-words text-sm leading-6 text-neutral-400">{text}</p></section> }
function EntitySelect({ label, value, onChange, rows, id, getLabel }: { label: string; value: string; onChange: (value: string) => void; rows: Row[]; id: string; getLabel: (row: Row) => string }) { return <label className="block min-w-0 text-xs font-bold uppercase tracking-wide text-neutral-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{rows.map((row) => <option key={row[id]} value={row[id]}>{getLabel(row)}</option>)}</select></label> }
function Field({ name, label, value, type = 'text', min, placeholder }: { name: string; label: string; value: unknown; type?: string; min?: string; placeholder?: string }) { return <label className="block min-w-0 text-xs font-bold uppercase tracking-wide text-neutral-500">{label}<input name={name} type={type} min={min} defaultValue={String(value ?? '')} placeholder={placeholder} className={inputClass} /></label> }
function TextArea({ name, label, value, placeholder }: { name: string; label: string; value: unknown; placeholder?: string }) { return <label className="block min-w-0 text-xs font-bold uppercase tracking-wide text-neutral-500">{label}<textarea name={name} defaultValue={String(value ?? '')} placeholder={placeholder} rows={4} className={`${inputClass} py-3`} /></label> }
function Select({ name, label, value, options, labels }: { name: string; label: string; value: unknown; options: string[]; labels?: string[] }) { return <label className="block min-w-0 text-xs font-bold uppercase tracking-wide text-neutral-500">{label}<select name={name} defaultValue={String(value ?? '')} className={inputClass}>{options.map((option, index) => <option key={`${name}-${option}`} value={option}>{labels?.[index] ?? option}</option>)}</select></label> }
function Submit({ label }: { label: string }) { return <button className="min-h-11 self-end rounded-lg bg-purple-700 px-5 font-black text-white hover:bg-purple-600">{label}</button> }
