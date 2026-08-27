/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { formatCompetitionAdminLabel } from '@/lib/competitions'
import {
  advancingParticipant,
  getNextPlayoffMatchOrder,
  getPlayoffRoundOrder,
  getPlayoffTierNumber,
  participantDestinationPatch,
  participantKey,
  PLAYOFF_ROUNDS,
  validatePlayoffMatch,
  type EditablePlayoffMatch,
  type ParticipantKind,
  type PlayoffParticipant,
  type WinnerSide,
} from '@/lib/playoffAdmin'
import { FLOP_RESET_PLAYOFF_TEAMS, playoffRoundOrder, shortFlopTeam } from '@/lib/playoffs'
import { getSeriesOutcome } from '@/lib/results'
import { supabase } from '@/lib/supabase'

type Row = Record<string, any>

const EMPTY_PARTICIPANT: PlayoffParticipant = { kind: 'tbd', identityId: null, snapshot: '' }

const EMPTY_MATCH: EditablePlayoffMatch = {
  roundName: '',
  matchOrder: 1,
  participantA: { ...EMPTY_PARTICIPANT },
  participantB: { ...EMPTY_PARTICIPANT },
  scoreA: null,
  scoreB: null,
  bestOf: null,
  scheduledAt: '',
  status: 'pending',
  winnerSide: null,
  isBye: false,
  isForfeit: false,
  seriesId: null,
  scheduledMatchId: null,
  notes: '',
  nextMatchId: null,
  nextSlot: null,
  loserNextMatchId: null,
  loserNextSlot: null,
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function participantFromRow(row: Row, side: 'a' | 'b', entries: Row[] = []): PlayoffParticipant {
  const teamId = numberOrNull(row[`flop_reset_team_${side}_id`])
  const opponentId = numberOrNull(row[`opponent_${side}_id`])
  const entryId = numberOrNull(row[`competition_entry_${side}_id`])
  const entry = entries.find((candidate) => Number(candidate.entry_id) === entryId)
  return {
    kind: teamId ? 'team' : opponentId ? 'opponent' : entryId ? 'entry' : 'tbd',
    identityId: teamId ?? opponentId ?? entryId,
    snapshot: String(row[`team_${side}_name`] ?? ''),
    linkedFrTeamId: numberOrNull(entry?.fr_team_id),
    linkedOpponentId: numberOrNull(entry?.opponent_id),
  }
}

function draftFromRow(row: Row, entries: Row[] = []): EditablePlayoffMatch {
  return {
    roundName: String(row.round_name ?? ''),
    matchOrder: Number(row.match_order ?? 1),
    participantA: participantFromRow(row, 'a', entries),
    participantB: participantFromRow(row, 'b', entries),
    scoreA: numberOrNull(row.score_a),
    scoreB: numberOrNull(row.score_b),
    bestOf: numberOrNull(row.best_of),
    scheduledAt: row.scheduled_at ? String(row.scheduled_at).slice(0, 16) : '',
    status: row.status === 'completed' || row.status === 'final'
      ? 'completed'
      : row.status === 'live' ? 'live' : row.status === 'scheduled' ? 'scheduled' : 'pending',
    winnerSide: row.winner_side === 'a' || row.winner_side === 'b' ? row.winner_side : null,
    isBye: Boolean(row.is_bye),
    isForfeit: Boolean(row.is_forfeit),
    seriesId: numberOrNull(row.series_id),
    scheduledMatchId: numberOrNull(row.scheduled_match_id),
    notes: String(row.notes ?? ''),
    nextMatchId: numberOrNull(row.next_match_id),
    nextSlot: numberOrNull(row.next_slot),
    loserNextMatchId: numberOrNull(row.loser_next_match_id),
    loserNextSlot: numberOrNull(row.loser_next_slot),
  }
}

function displayParticipant(row: Row, side: 'a' | 'b') {
  return String(row[`team_${side}_name`] ?? '').trim() || 'TBD'
}

function IdentityBadge({ name, kind }: { name: string; kind: ParticipantKind }) {
  const initials = name === 'TBD' ? '?' : name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <span aria-hidden className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-black ${kind === 'team' ? 'bg-purple-700 text-white' : kind === 'entry' ? 'bg-cyan-800 text-white' : kind === 'opponent' ? 'bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-500'}`}>{initials}</span>
}

function participantKind(row: Row, side: 'a' | 'b'): ParticipantKind {
  return row[`flop_reset_team_${side}_id`] ? 'team' : row[`opponent_${side}_id`] ? 'opponent' : row[`competition_entry_${side}_id`] ? 'entry' : 'tbd'
}

export function PlayoffAdminEditor() {
  const [competitions, setCompetitions] = useState<Row[]>([])
  const [teams, setTeams] = useState<Row[]>([])
  const [opponents, setOpponents] = useState<Row[]>([])
  const [entries, setEntries] = useState<Row[]>([])
  const [brackets, setBrackets] = useState<Row[]>([])
  const [matches, setMatches] = useState<Row[]>([])
  const [series, setSeries] = useState<Row[]>([])
  const [schedule, setSchedule] = useState<Row[]>([])
  const [competitionId, setCompetitionId] = useState('')
  const [tier, setTier] = useState('')
  const [bracketId, setBracketId] = useState('')
  const [roundFilter, setRoundFilter] = useState('All')
  const [teamFilter, setTeamFilter] = useState('All')
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null)
  const [draft, setDraft] = useState<EditablePlayoffMatch>(EMPTY_MATCH)
  const [originalDraft, setOriginalDraft] = useState<EditablePlayoffMatch>(EMPTY_MATCH)
  const [advancedStructure, setAdvancedStructure] = useState(false)
  const [schemaReady, setSchemaReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [newBracketName, setNewBracketName] = useState('')
  const [newBracketTier, setNewBracketTier] = useState('')
  const [newMatchRound, setNewMatchRound] = useState<string>('Opening Round')
  const [newMatchBestOf, setNewMatchBestOf] = useState<number | null>(null)

  async function loadData(preferredMatchId?: number | null) {
    setLoading(true)
    const [competitionResult, teamResult, opponentResult, entryResult, bracketResult, matchResult, seriesResult, scheduleResult, schemaProbe] = await Promise.all([
      supabase.from('competitions').select('id, name, format').order('id'),
      supabase.from('teams').select('id, name, format').order('name'),
      supabase.from('opponents').select('opponent_id, canonical_name, normalized_name').order('canonical_name'),
      supabase.from('competition_entries').select('entry_id, competition_id, fr_team_id, opponent_id, display_name_snapshot, tier, competitive_status, status').order('display_name_snapshot'),
      supabase.from('playoff_brackets').select('*').order('tier'),
      supabase.from('playoff_matches').select('*').order('match_order'),
      supabase.from('series').select('series_id, competition_id, flop_reset_team_id, opponent_name, series_date, notes, teams(name, format), matches(*)').order('series_date', { ascending: false }),
      supabase.from('scheduled_matches').select('scheduled_id, competition_id, flop_reset_team_id, opponent_name, match_date, match_time, status, teams(name, format)').order('match_date'),
      supabase.from('playoff_matches').select('playoff_match_id, team_a_name, team_b_name, best_of, is_forfeit, score_a, score_b, winner_name, flop_reset_team_a_id, opponent_a_id, competition_entry_a_id').limit(1),
    ])
    const failure = [competitionResult, teamResult, opponentResult, entryResult, bracketResult, matchResult, seriesResult, scheduleResult]
      .find((result) => result.error)?.error
    if (failure) setMessage(`Playoff data could not be loaded: ${failure.message}`)

    const nextCompetitions = competitionResult.data ?? []
    const nextBrackets = bracketResult.data ?? []
    const nextMatches = matchResult.data ?? []
    setCompetitions(nextCompetitions)
    setTeams(teamResult.data ?? [])
    setOpponents(opponentResult.data ?? [])
    setEntries(entryResult.data ?? [])
    setBrackets(nextBrackets)
    setMatches(nextMatches)
    setSeries(seriesResult.data ?? [])
    setSchedule(scheduleResult.data ?? [])
    setSchemaReady(!schemaProbe.error)
    setCompetitionId((current) => current || String(nextCompetitions[0]?.id ?? ''))

    const id = preferredMatchId ?? selectedMatchId
    const selected = nextMatches.find((row) => Number(row.playoff_match_id) === Number(id))
    if (selected) {
      const nextDraft = draftFromRow(selected, entryResult.data ?? [])
      setSelectedMatchId(Number(selected.playoff_match_id))
      setDraft(nextDraft)
      setOriginalDraft(nextDraft)
    }
    setLoading(false)
  }

  useEffect(() => { void loadData() }, [])

  const competitionBrackets = useMemo(
    () => brackets.filter((row) => String(row.competition_id) === competitionId),
    [brackets, competitionId],
  )
  const tiers = [...new Set(competitionBrackets
    .map((row) => getPlayoffTierNumber(row.tier, row.name))
    .filter((value): value is number => value !== null))]
    .sort((a, b) => a - b)
    .map(String)

  useEffect(() => {
    if (!tiers.includes(tier)) setTier(tiers[0] ?? '')
  }, [competitionId, tiers.join('|')])

  const tierBrackets = competitionBrackets.filter((row) => String(getPlayoffTierNumber(row.tier, row.name) ?? '') === tier)
  useEffect(() => {
    if (!tierBrackets.some((row) => String(row.bracket_id) === bracketId)) {
      setBracketId(String(tierBrackets[0]?.bracket_id ?? ''))
      setSelectedMatchId(null)
    }
  }, [tier, competitionId, tierBrackets.map((row) => row.bracket_id).join('|')])

  const bracketMatches = matches
    .filter((row) => String(row.bracket_id) === bracketId)
    .sort((a, b) => playoffRoundOrder(a.round_name) - playoffRoundOrder(b.round_name) || Number(a.match_order) - Number(b.match_order))
  const rounds = [...new Set(bracketMatches.map((row) => String(row.round_name || 'Stage TBD')))]
  const newMatchOrder = getNextPlayoffMatchOrder(bracketMatches, newMatchRound)
  const visibleMatches = bracketMatches.filter((row) => {
    const roundMatches = roundFilter === 'All' || String(row.round_name || 'Stage TBD') === roundFilter
    const pathMatches = teamFilter === 'All' || shortFlopTeam(displayParticipant(row, 'a')) === teamFilter || shortFlopTeam(displayParticipant(row, 'b')) === teamFilter
    return roundMatches && pathMatches
  })

  const selectedRow = matches.find((row) => Number(row.playoff_match_id) === selectedMatchId) ?? null
  const linkedSeries = series.find((row) => Number(row.series_id) === draft.seriesId) ?? null
  const linkedSeriesOutcome = linkedSeries ? getSeriesOutcome(linkedSeries.matches ?? [], linkedSeries) : null
  const linkedSeriesTeamSide: WinnerSide = linkedSeries
    ? ((draft.participantA.kind === 'team' && draft.participantA.identityId === Number(linkedSeries.flop_reset_team_id)) || (draft.participantA.kind === 'entry' && draft.participantA.linkedFrTeamId === Number(linkedSeries.flop_reset_team_id))) ? 'a'
      : ((draft.participantB.kind === 'team' && draft.participantB.identityId === Number(linkedSeries.flop_reset_team_id)) || (draft.participantB.kind === 'entry' && draft.participantB.linkedFrTeamId === Number(linkedSeries.flop_reset_team_id))) ? 'b'
        : null
    : null
  const effectiveWinnerSide: WinnerSide = linkedSeriesOutcome && linkedSeriesTeamSide
    ? linkedSeriesOutcome.won ? linkedSeriesTeamSide : linkedSeriesOutcome.lost ? linkedSeriesTeamSide === 'a' ? 'b' : 'a' : null
    : draft.winnerSide

  function selectMatch(row: Row) {
    const nextDraft = draftFromRow(row, entries)
    setSelectedMatchId(Number(row.playoff_match_id))
    setDraft(nextDraft)
    setOriginalDraft(nextDraft)
    setAdvancedStructure(false)
    setMessage('')
  }

  async function createBracket() {
    const bracketTier = getPlayoffTierNumber(newBracketTier)
    if (!competitionId || !newBracketName.trim() || bracketTier === null) {
      setMessage('Competition, tier, and bracket name are required.')
      return
    }
    const { data, error } = await supabase.from('playoff_brackets').insert({
      competition_id: Number(competitionId),
      tier: bracketTier,
      name: newBracketName.trim(),
      status: 'active',
    }).select().single()
    if (error || !data) {
      setMessage(`Could not create bracket: ${error?.message ?? 'unknown error'}`)
      return
    }
    setNewBracketName('')
    setNewBracketTier('')
    setTier(String(getPlayoffTierNumber(data.tier, data.name) ?? bracketTier))
    setBracketId(String(data.bracket_id))
    setMessage('Bracket created. No teams or routes were invented.')
    await loadData()
  }

  async function repairSelectedBracketTier() {
    const selected = brackets.find((row) => String(row.bracket_id) === bracketId)
    const bracketTier = getPlayoffTierNumber(selected?.tier, selected?.name)
    if (!selected || bracketTier === null) {
      setMessage('Could not determine a valid tier for the selected bracket.')
      return
    }
    const { error } = await supabase.from('playoff_brackets')
      .update({ tier: bracketTier })
      .eq('bracket_id', Number(selected.bracket_id))
    if (error) {
      setMessage(`Could not save Tier ${bracketTier}: ${error.message}`)
      return
    }
    setTier(String(bracketTier))
    setMessage(`Selected bracket metadata corrected to Tier ${bracketTier}.`)
    await loadData()
  }

  async function createMatch() {
    if (!bracketId || !schemaReady) {
      setMessage(schemaReady ? 'Select a bracket first.' : 'Apply the reviewed V2.3.8 playoff fields and V2.3.9 league-directory migration before creating playoff matches.')
      return
    }
    if (selectedBracketTierNeedsRepair) {
      setMessage(`Save the selected bracket as Tier ${selectedBracketTier} before adding matches.`)
      return
    }
    const roundOrder = getPlayoffRoundOrder(newMatchRound)
    if (roundOrder === null) {
      setMessage('Select a valid playoff round before creating this match.')
      return
    }
    if (newMatchOrder === null) {
      setMessage('Could not generate a safe match number for this round. No match was created.')
      return
    }
    if (newMatchBestOf !== null && (!Number.isInteger(newMatchBestOf) || newMatchBestOf < 1 || newMatchBestOf % 2 === 0)) {
      setMessage('Best-of must be a positive odd number or left blank. No match was created.')
      return
    }
    const { data, error } = await supabase.from('playoff_matches').insert({
      bracket_id: Number(bracketId),
      round_name: newMatchRound,
      round_order: roundOrder,
      match_order: newMatchOrder,
      best_of: newMatchBestOf,
      status: 'tbd',
      is_bye: false,
      is_forfeit: false,
    }).select().single()
    if (error || !data) {
      setMessage(`Could not create playoff match: ${error?.message ?? 'unknown error'}`)
      return
    }
    setMessage(`${newMatchRound} Match ${newMatchOrder} created. Add verified participants and routing.`)
    await loadData(Number(data.playoff_match_id))
  }

  function routingChanged() {
    return draft.nextMatchId !== originalDraft.nextMatchId || draft.nextSlot !== originalDraft.nextSlot ||
      draft.loserNextMatchId !== originalDraft.loserNextMatchId || draft.loserNextSlot !== originalDraft.loserNextSlot
  }

  async function saveMatch() {
    if (!selectedMatchId || !selectedRow) return
    const normalized: EditablePlayoffMatch = draft.isBye
      ? {
          ...draft,
          scoreA: null,
          scoreB: null,
          bestOf: null,
          status: 'completed',
          winnerSide: draft.participantA.kind !== 'tbd' ? 'a' : draft.participantB.kind !== 'tbd' ? 'b' : null,
          isForfeit: false,
          seriesId: null,
          scheduledMatchId: null,
        }
      : draft.seriesId
        ? { ...draft, scoreA: null, scoreB: null, winnerSide: null, isForfeit: false }
        : draft.isForfeit
          ? { ...draft, scoreA: null, scoreB: null }
          : draft
    setDraft(normalized)
    const normalizedRoundOrder = getPlayoffRoundOrder(normalized.roundName)
    const errors = validatePlayoffMatch(normalized, linkedSeries?.flop_reset_team_id)
    if (errors.length) {
      setMessage(`Save blocked: ${errors.join(' ')}`)
      return
    }
    if (normalizedRoundOrder === null) {
      setMessage('Save blocked: select a valid playoff round.')
      return
    }
    if (routingChanged() && !advancedStructure) {
      setMessage('Routing changed outside Advanced Bracket Structure. Save blocked.')
      return
    }
    if (routingChanged() && !confirm('Save advanced bracket-routing changes? Incorrect destinations can damage the tournament topology.')) return

    const winnerParticipant = normalized.winnerSide === 'a' ? normalized.participantA : normalized.winnerSide === 'b' ? normalized.participantB : null
    const payload = {
      round_name: normalized.roundName.trim(),
      round_order: normalizedRoundOrder,
      match_order: normalized.matchOrder,
      team_a_name: normalized.participantA.snapshot.trim() || null,
      team_b_name: normalized.participantB.snapshot.trim() || null,
      flop_reset_team_a_id: normalized.participantA.kind === 'team' ? normalized.participantA.identityId : null,
      flop_reset_team_b_id: normalized.participantB.kind === 'team' ? normalized.participantB.identityId : null,
      opponent_a_id: normalized.participantA.kind === 'opponent' ? normalized.participantA.identityId : null,
      opponent_b_id: normalized.participantB.kind === 'opponent' ? normalized.participantB.identityId : null,
      competition_entry_a_id: normalized.participantA.kind === 'entry' ? normalized.participantA.identityId : null,
      competition_entry_b_id: normalized.participantB.kind === 'entry' ? normalized.participantB.identityId : null,
      score_a: normalized.scoreA,
      score_b: normalized.scoreB,
      best_of: normalized.bestOf,
      scheduled_at: normalized.scheduledAt || null,
      status: normalized.status === 'pending' ? 'tbd' : normalized.status,
      winner_side: normalized.winnerSide,
      winner_name: winnerParticipant?.snapshot || null,
      is_bye: normalized.isBye,
      is_forfeit: normalized.isForfeit,
      series_id: normalized.seriesId,
      scheduled_match_id: normalized.scheduledMatchId,
      notes: normalized.notes.trim() || null,
      next_match_id: normalized.nextMatchId,
      next_slot: normalized.nextSlot,
      loser_next_match_id: normalized.loserNextMatchId,
      loser_next_slot: normalized.loserNextSlot,
    }
    const { error } = await supabase.from('playoff_matches').update(payload).eq('playoff_match_id', selectedMatchId)
    if (error) {
      setMessage(`Save failed: ${error.message}`)
      return
    }
    setMessage(normalized.isBye
      ? 'BYE saved: participant advanced with no series, game, W/L, stats, or Power evidence.'
      : normalized.seriesId ? 'Playoff link saved. The canonical FR series remains the result source of truth.' : 'Playoff match saved.')
    await loadData(selectedMatchId)
  }

  function destinationLabel(matchId: number | null, slot: number | null) {
    if (!matchId) return 'Not configured'
    const destination = matches.find((row) => Number(row.playoff_match_id) === Number(matchId))
    return destination ? `${destination.round_name || 'Stage'} Match #${destination.match_order || destination.playoff_match_id} · Slot ${slot ?? '—'}` : `Missing Match #${matchId} · Slot ${slot ?? '—'}`
  }

  async function advance(mode: 'winner' | 'loser') {
    if (!selectedMatchId) return
    if (draft.status !== 'completed') {
      setMessage('Advancement is available only for a Final-status match.')
      return
    }
    const effectiveDraft = { ...draft, winnerSide: effectiveWinnerSide }
    const participant = advancingParticipant(effectiveDraft, mode)
    const destinationId = mode === 'winner' ? draft.nextMatchId : draft.loserNextMatchId
    const destinationSlot = mode === 'winner' ? draft.nextSlot : draft.loserNextSlot
    if (!participant || !destinationId || (destinationSlot !== 1 && destinationSlot !== 2)) {
      setMessage(`${mode === 'winner' ? 'Winner' : 'Loser'} advancement is not fully configured.`)
      return
    }
    const destination = matches.find((row) => Number(row.playoff_match_id) === destinationId)
    if (!destination) {
      setMessage('Configured destination match does not exist.')
      return
    }
    const occupied = participantFromRow(destination, destinationSlot === 1 ? 'a' : 'b', entries)
    if (occupied.kind !== 'tbd') {
      if (participantKey(occupied) === participantKey(participant)) {
        setMessage(`${participant.snapshot} is already in ${destinationLabel(destinationId, destinationSlot)}. No duplicate advancement was written.`)
      } else {
        setMessage(`Destination is occupied by ${occupied.snapshot}. Advancement blocked.`)
      }
      return
    }
    const action = mode === 'winner' ? 'Advance winner' : 'Advance loser to 3rd place'
    if (!confirm(`${action}: ${participant.snapshot} → ${destinationLabel(destinationId, destinationSlot)}?`)) return
    const { error } = await supabase.from('playoff_matches')
      .update(participantDestinationPatch(participant, destinationSlot))
      .eq('playoff_match_id', destinationId)
    if (error) {
      setMessage(`Advancement failed: ${error.message}`)
      return
    }
    setMessage(`${participant.snapshot} advanced to ${destinationLabel(destinationId, destinationSlot)}.`)
    await loadData(selectedMatchId)
  }

  const selectedCompetition = competitions.find((row) => String(row.id) === competitionId)
  const selectedBracket = brackets.find((row) => String(row.bracket_id) === bracketId) ?? null
  const selectedBracketTier = getPlayoffTierNumber(selectedBracket?.tier, selectedBracket?.name)
  const selectedBracketTierNeedsRepair = selectedBracketTier !== null && String(selectedBracket?.tier ?? '').trim() !== String(selectedBracketTier)
  const filteredSeries = series.filter((row) => String(row.competition_id) === competitionId)
  const filteredSchedule = schedule.filter((row) => String(row.competition_id) === competitionId)

  return <div className="min-w-0 space-y-6">
    {!schemaReady && <section className="rounded-xl border border-amber-800 bg-amber-950/20 p-4 text-sm text-amber-100"><div className="font-black text-amber-300">PLAYOFF DIRECTORY SCHEMA PREPARED</div><p className="mt-2 text-xs leading-5 text-amber-100/70">The reviewed V2.3.8 playoff fields and V2.3.9 competition-entry columns must be applied before bracket participants can be edited. Existing bracket discovery remains read-only.</p></section>}

    <section className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-4 sm:p-5">
      <div className="text-xs font-black uppercase tracking-[.2em] text-purple-300">Competition → Tier → Bracket → Match</div>
      <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-3">
        <SelectField label="Competition" value={competitionId} onChange={(value) => { setCompetitionId(value); setTier(''); setBracketId(''); setSelectedMatchId(null) }} options={competitions.map((row) => ({ value: String(row.id), label: formatCompetitionAdminLabel(row) }))} />
        <SelectField label="Tier" value={tier} onChange={(value) => { setTier(value); setBracketId(''); setSelectedMatchId(null) }} options={tiers.map((value) => ({ value, label: `Tier ${value}` }))} placeholder="No tiers recorded" />
        <SelectField label="Bracket" value={bracketId} onChange={(value) => { setBracketId(value); setSelectedMatchId(null) }} options={tierBrackets.map((row) => ({ value: String(row.bracket_id), label: row.name || `Bracket #${row.bracket_id}` }))} placeholder="No bracket recorded" />
      </div>
      {selectedBracketTierNeedsRepair && <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-900 bg-amber-950/15 p-4 text-xs text-amber-100 sm:flex-row sm:items-center sm:justify-between"><span>This legacy bracket has its name stored in the tier field. Save the canonical numeric tier before adding matches.</span><button type="button" onClick={repairSelectedBracketTier} className="min-h-11 shrink-0 rounded-lg border border-amber-700 px-4 font-black text-amber-300">Save Tier {selectedBracketTier}</button></div>}
      <details className="mt-5 rounded-xl border border-neutral-800 bg-black/20 p-4">
        <summary className="cursor-pointer text-sm font-bold text-neutral-300">Create a verified bracket</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input type="number" min="1" step="1" value={newBracketTier} onChange={(event) => setNewBracketTier(event.target.value)} placeholder="Tier number, e.g. 4" aria-label="New bracket tier" className="min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm" />
          <input value={newBracketName} onChange={(event) => setNewBracketName(event.target.value)} placeholder="Official bracket name" className="min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm" />
          <button type="button" onClick={createBracket} className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-bold text-white">Create</button>
        </div>
        <p className="mt-2 text-xs text-neutral-600">Creates only the named bracket. It does not seed teams, tiers, matches, or routes.</p>
      </details>
    </section>

    <section>
      <div><div className="text-xs font-black uppercase tracking-[.18em] text-purple-300">Public-like bracket preview</div><h2 className="mt-1 text-2xl font-black text-white">{tierBrackets.find((row) => String(row.bracket_id) === bracketId)?.name ?? 'No bracket selected'}</h2></div>
      <section className="mt-5 rounded-2xl border border-purple-900/70 bg-purple-950/10 p-4 sm:p-5">
        <div className="text-xs font-black uppercase tracking-[.18em] text-purple-300">Add Playoff Match</div>
        <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Round" value={newMatchRound} onChange={setNewMatchRound} options={PLAYOFF_ROUNDS.map((value) => ({ value, label: value }))} />
          <div className="rounded-lg border border-neutral-800 bg-black/20 px-3 py-2"><div className="text-xs font-bold uppercase tracking-wide text-neutral-500">Match</div><div className="mt-1 text-sm font-black text-white">{newMatchOrder === null ? 'Unavailable' : `Auto: Match ${newMatchOrder}`}</div></div>
          <NumberField label="Best of (optional)" value={newMatchBestOf} onChange={setNewMatchBestOf} min={1} />
          <div className="rounded-lg border border-neutral-800 bg-black/20 px-3 py-2"><div className="text-xs font-bold uppercase tracking-wide text-neutral-500">Status</div><div className="mt-1 text-sm font-black text-white">TBD</div></div>
        </div>
        <div className="mt-4 grid gap-2 text-xs text-neutral-500 sm:grid-cols-2"><div>Participant 1: <strong className="text-neutral-300">TBD</strong></div><div>Participant 2: <strong className="text-neutral-300">TBD</strong></div></div>
        <button type="button" onClick={createMatch} disabled={!bracketId || !schemaReady || selectedBracketTierNeedsRepair || getPlayoffRoundOrder(newMatchRound) === null || newMatchOrder === null} className="mt-4 min-h-11 w-full rounded-lg bg-purple-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500 sm:w-auto">Create Match</button>
      </section>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SelectField label="Preview round" value={roundFilter} onChange={setRoundFilter} options={['All', ...rounds].map((value) => ({ value, label: value }))} />
        <SelectField label="FR path" value={teamFilter} onChange={setTeamFilter} options={['All', ...FLOP_RESET_PLAYOFF_TEAMS].map((value) => ({ value, label: value }))} />
      </div>
      {loading ? <p className="mt-5 text-sm text-neutral-500">Loading playoff data…</p> : visibleMatches.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleMatches.map((row) => {
        const active = Number(row.playoff_match_id) === selectedMatchId
        const a = displayParticipant(row, 'a')
        const b = row.is_bye ? 'BYE' : displayParticipant(row, 'b')
        return <button key={row.playoff_match_id} type="button" onClick={() => selectMatch(row)} className={`min-w-0 rounded-2xl border p-4 text-left ${active ? 'border-purple-500 bg-purple-950/25' : 'border-neutral-800 bg-[#111] hover:border-purple-800'}`}>
          <div className="flex items-center justify-between gap-2 text-xs text-neutral-500"><span>{row.round_name || 'Stage TBD'} · Match {row.match_order || row.playoff_match_id}</span><span className="font-black uppercase">{row.is_bye ? 'BYE' : row.is_forfeit ? 'FORFEIT' : row.status || 'TBD'}</span></div>
          {[[a, row.score_a, 'a'], [b, row.score_b, 'b']].map(([name, score, side]) => <div key={String(side)} className="mt-3 flex min-w-0 items-center gap-3 rounded-lg bg-black/25 px-3 py-2"><IdentityBadge name={String(name)} kind={participantKind(row, side as 'a' | 'b')} /><span className="min-w-0 flex-1 truncate font-bold text-white">{name}</span><span className="font-black text-purple-300">{row.is_forfeit ? '0' : score ?? '—'}</span></div>)}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-neutral-600">{row.series_id ? `Linked Series #${row.series_id}` : 'Bracket result'}</span>{row.scheduled_at && <span className="text-neutral-500">{new Date(row.scheduled_at).toLocaleString()}</span>}</div>
        </button>
      })}</div> : <div className="mt-5 rounded-2xl border border-dashed border-neutral-800 p-6 text-sm text-neutral-500"><div className="font-black text-neutral-300">No matches yet.</div><ol className="mt-3 list-decimal space-y-1 pl-5"><li>Select a round</li><li>Add the matches in bracket order</li><li>Assign participants</li><li>Configure advancement routes</li></ol><div className="mt-4 text-xs text-purple-300">Opening Round → Quarterfinal → Semifinal → Final / 3rd Place</div></div>}
    </section>

    {selectedMatchId && selectedRow && <section className="rounded-2xl border border-neutral-800 bg-[#111] p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-black uppercase tracking-[.18em] text-purple-300">Match Editor</div><h2 className="mt-1 text-2xl font-black">{draft.roundName || 'Stage TBD'} · Match {draft.matchOrder}</h2></div>{draft.seriesId && <Link href={`/matches/${draft.seriesId}`} className="text-sm font-bold text-purple-300 hover:underline">Linked Series #{draft.seriesId} →</Link>}</div>
      {draft.seriesId && <p className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/15 p-3 text-xs text-emerald-200">Canonical linked series/result is the statistical source of truth. Local score, winner, and forfeit fields are cleared on save.</p>}
      <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
        <TextField label="Round" value={draft.roundName} onChange={(value) => setDraft({ ...draft, roundName: value })} />
        <NumberField label="Match number" value={draft.matchOrder} onChange={(value) => setDraft({ ...draft, matchOrder: value ?? 1 })} min={1} />
      </div>

      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
        <ParticipantPicker label="Participant 1" participant={draft.participantA} teams={teams.filter((row) => !selectedCompetition?.format || row.format === selectedCompetition.format)} opponents={opponents} entries={competitionEntriesForPicker(entries, competitionId, tier)} onChange={(participant) => setDraft({ ...draft, participantA: participant })} />
        <ParticipantPicker label="Participant 2" participant={draft.participantB} teams={teams.filter((row) => !selectedCompetition?.format || row.format === selectedCompetition.format)} opponents={opponents} entries={competitionEntriesForPicker(entries, competitionId, tier)} onChange={(participant) => setDraft({ ...draft, participantB: participant })} />
      </div>

      <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField label="Score 1" value={draft.scoreA} onChange={(value) => setDraft({ ...draft, scoreA: value })} min={0} disabled={Boolean(draft.seriesId) || draft.isBye || draft.isForfeit} />
        <NumberField label="Score 2" value={draft.scoreB} onChange={(value) => setDraft({ ...draft, scoreB: value })} min={0} disabled={Boolean(draft.seriesId) || draft.isBye || draft.isForfeit} />
        <NumberField label="Best of" value={draft.bestOf} onChange={(value) => setDraft({ ...draft, bestOf: value })} min={1} disabled={draft.isBye} />
        <TextField label="Scheduled date/time" type="datetime-local" value={draft.scheduledAt} onChange={(value) => setDraft({ ...draft, scheduledAt: value })} />
      </div>

      <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField label="Status" value={draft.status} onChange={(value) => setDraft({ ...draft, status: value as EditablePlayoffMatch['status'] })} options={[['pending', 'TBD'], ['scheduled', 'Scheduled'], ['live', 'Live'], ['completed', 'Final']].map(([value, label]) => ({ value, label }))} />
        <SelectField label="Winner" value={effectiveWinnerSide ?? ''} onChange={(value) => setDraft({ ...draft, winnerSide: (value || null) as WinnerSide })} disabled={Boolean(draft.seriesId) || draft.isBye} options={[{ value: '', label: 'None' }, { value: 'a', label: 'Participant 1' }, { value: 'b', label: 'Participant 2' }]} />
        <SelectField label="Linked series" value={String(draft.seriesId ?? '')} onChange={(value) => setDraft({ ...draft, seriesId: numberOrNull(value), scoreA: null, scoreB: null, winnerSide: null, isForfeit: false })} disabled={draft.isBye} options={[{ value: '', label: 'None' }, ...filteredSeries.map((row) => ({ value: String(row.series_id), label: `#${row.series_id} · ${row.teams?.name ?? 'FR'} vs ${row.opponent_name} · ${row.series_date}` }))]} />
        <SelectField label="Linked scheduled match" value={String(draft.scheduledMatchId ?? '')} onChange={(value) => setDraft({ ...draft, scheduledMatchId: numberOrNull(value) })} disabled={draft.isBye} options={[{ value: '', label: 'None' }, ...filteredSchedule.map((row) => ({ value: String(row.scheduled_id), label: `#${row.scheduled_id} · ${row.teams?.name ?? 'FR'} vs ${row.opponent_name} · ${row.match_date}` }))]} />
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-neutral-800 bg-black/20 p-4 sm:flex-row sm:items-center">
        <CheckField label="BYE" checked={draft.isBye} onChange={(checked) => setDraft({ ...draft, isBye: checked, isForfeit: checked ? false : draft.isForfeit, scoreA: checked ? null : draft.scoreA, scoreB: checked ? null : draft.scoreB, seriesId: checked ? null : draft.seriesId, scheduledMatchId: checked ? null : draft.scheduledMatchId })} />
        <CheckField label="Forfeit" checked={draft.isForfeit} disabled={draft.isBye || Boolean(draft.seriesId)} onChange={(checked) => setDraft({ ...draft, isForfeit: checked, scoreA: checked ? null : draft.scoreA, scoreB: checked ? null : draft.scoreB })} />
        <span className="text-xs text-neutral-500">BYE creates no series, game, W/L, stats, or Power evidence. Forfeit is a distinct official result.</span>
      </div>

      <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Notes<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={3} className="mt-1 block w-full min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm normal-case tracking-normal text-white" /></label>

      <div className="mt-5 grid gap-3 sm:grid-cols-2"><RouteSummary label="Winner →" value={destinationLabel(draft.nextMatchId, draft.nextSlot)} /><RouteSummary label="Loser →" value={destinationLabel(draft.loserNextMatchId, draft.loserNextSlot)} /></div>

      <details open={advancedStructure} onToggle={(event) => setAdvancedStructure(event.currentTarget.open)} className="mt-5 rounded-xl border border-red-900/70 bg-red-950/10 p-4">
        <summary className="cursor-pointer text-sm font-black text-red-300">ADVANCED BRACKET STRUCTURE</summary>
        <p className="mt-2 text-xs text-red-100/60">Routing edits can damage the bracket. Normal result editing does not change these fields.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Winner next match" value={String(draft.nextMatchId ?? '')} onChange={(value) => setDraft({ ...draft, nextMatchId: numberOrNull(value) })} options={[{ value: '', label: 'None / Final' }, ...bracketMatches.filter((row) => Number(row.playoff_match_id) !== selectedMatchId).map((row) => ({ value: String(row.playoff_match_id), label: `${row.round_name} · Match ${row.match_order}` }))]} />
          <SelectField label="Winner slot" value={String(draft.nextSlot ?? '')} onChange={(value) => setDraft({ ...draft, nextSlot: numberOrNull(value) })} options={[{ value: '', label: 'None' }, { value: '1', label: 'Slot 1' }, { value: '2', label: 'Slot 2' }]} />
          <SelectField label="Loser next match" value={String(draft.loserNextMatchId ?? '')} onChange={(value) => setDraft({ ...draft, loserNextMatchId: numberOrNull(value) })} options={[{ value: '', label: 'None' }, ...bracketMatches.filter((row) => Number(row.playoff_match_id) !== selectedMatchId).map((row) => ({ value: String(row.playoff_match_id), label: `${row.round_name} · Match ${row.match_order}` }))]} />
          <SelectField label="Loser slot" value={String(draft.loserNextSlot ?? '')} onChange={(value) => setDraft({ ...draft, loserNextSlot: numberOrNull(value) })} options={[{ value: '', label: 'None' }, { value: '1', label: 'Slot 1' }, { value: '2', label: 'Slot 2' }]} />
        </div>
      </details>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" onClick={saveMatch} disabled={!schemaReady} className="min-h-11 rounded-lg bg-purple-700 px-5 text-sm font-black text-white disabled:bg-neutral-800 disabled:text-neutral-500">Save Match</button>
        {effectiveWinnerSide && <button type="button" onClick={() => advance('winner')} className="min-h-11 rounded-lg bg-emerald-700 px-5 text-sm font-black text-white">Advance Winner</button>}
        {effectiveWinnerSide && draft.loserNextMatchId && <button type="button" onClick={() => advance('loser')} className="min-h-11 rounded-lg border border-amber-700 px-5 text-sm font-black text-amber-300">Advance Loser to 3rd Place</button>}
      </div>
    </section>}

    {message && <p role="status" className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-300">{message}</p>}
  </div>
}

function ParticipantPicker({ label, participant, teams, opponents, entries, onChange }: {
  label: string
  participant: PlayoffParticipant
  teams: Row[]
  opponents: Row[]
  entries: Row[]
  onChange: (participant: PlayoffParticipant) => void
}) {
  const options = participant.kind === 'team'
    ? teams.map((row) => ({ id: Number(row.id), name: String(row.name), linkedFrTeamId: Number(row.id), linkedOpponentId: null }))
    : participant.kind === 'opponent'
      ? opponents.map((row) => ({ id: Number(row.opponent_id), name: String(row.canonical_name), linkedFrTeamId: null, linkedOpponentId: Number(row.opponent_id) }))
      : participant.kind === 'entry'
        ? entries.map((row) => ({ id: Number(row.entry_id), name: `${row.display_name_snapshot}${row.tier ? ` · Tier ${row.tier}` : ''}`, linkedFrTeamId: numberOrNull(row.fr_team_id), linkedOpponentId: numberOrNull(row.opponent_id) }))
        : []
  return <fieldset className="min-w-0 rounded-xl border border-neutral-800 bg-black/20 p-4"><legend className="px-1 text-sm font-black text-white">{label}</legend>
    <SelectField label="Identity type" value={participant.kind} onChange={(value) => onChange({ kind: value as ParticipantKind, identityId: null, snapshot: '' })} options={[{ value: 'entry', label: 'Competition entry' }, { value: 'team', label: 'Flop Reset team' }, { value: 'opponent', label: 'Canonical league team' }, { value: 'tbd', label: 'TBD' }]} />
    {participant.kind !== 'tbd' && <div className="mt-3"><SelectField label={participant.kind === 'entry' ? 'Competition field participant' : 'Canonical identity'} value={String(participant.identityId ?? '')} onChange={(value) => { const selected = options.find((option) => String(option.id) === value); onChange({ ...participant, identityId: numberOrNull(value), snapshot: participant.snapshot || selected?.name?.replace(/ · Tier \d+$/, '') || '', linkedFrTeamId: selected?.linkedFrTeamId ?? null, linkedOpponentId: selected?.linkedOpponentId ?? null }) }} options={[{ value: '', label: 'Select identity' }, ...options.map((option) => ({ value: String(option.id), label: option.name }))]} /></div>}
    <div className="mt-3"><TextField label="Display-name snapshot" value={participant.snapshot} disabled={participant.kind === 'tbd'} onChange={(value) => onChange({ ...participant, snapshot: value })} placeholder="League-facing name" /></div>
  </fieldset>
}

function competitionEntriesForPicker(entries: Row[], competitionId: string, tier: string) {
  return entries
    .filter((entry) => String(entry.competition_id) === competitionId && entry.status !== 'archived')
    .sort((a, b) => Number(String(b.tier ?? '') === tier) - Number(String(a.tier ?? '') === tier) || String(a.display_name_snapshot).localeCompare(String(b.display_name_snapshot)))
}

function SelectField({ label, value, onChange, options, placeholder, disabled }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; placeholder?: string; disabled?: boolean }) {
  return <label className="block min-w-0 text-xs font-bold uppercase tracking-wide text-neutral-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm normal-case tracking-normal text-white disabled:cursor-not-allowed disabled:opacity-50">{placeholder && !options.length && <option value="">{placeholder}</option>}{options.map((option) => <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>)}</select></label>
}

function TextField({ label, value, onChange, type = 'text', disabled, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean; placeholder?: string }) {
  return <label className="block min-w-0 text-xs font-bold uppercase tracking-wide text-neutral-500">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} placeholder={placeholder} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm normal-case tracking-normal text-white disabled:opacity-50" /></label>
}

function NumberField({ label, value, onChange, min, disabled }: { label: string; value: number | null; onChange: (value: number | null) => void; min?: number; disabled?: boolean }) {
  return <label className="block min-w-0 text-xs font-bold uppercase tracking-wide text-neutral-500">{label}<input type="number" value={value ?? ''} min={min} step="1" onChange={(event) => onChange(numberOrNull(event.target.value))} disabled={disabled} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm normal-case tracking-normal text-white disabled:opacity-50" /></label>
}

function CheckField({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-white"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-purple-600" />{label}</label>
}

function RouteSummary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-neutral-800 bg-black/20 p-4"><div className="text-xs font-black uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-2 text-sm font-bold text-white">{value}</div></div>
}
