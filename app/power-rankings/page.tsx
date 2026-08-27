/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { competitionIdentity } from '@/lib/competitions'
import { calculateEloWithHistory, RATING_MODEL_VERSION, type LeagueMatch } from '@/lib/elo'
import { PowerHistoryChart } from '@/components/PowerHistoryChart'
import { PowerRankingsTable } from '@/components/PowerRankingsTable'

export const dynamic = 'force-dynamic'
const FLOP_TEAMS = ['Flop Reset Frameshift', 'Flop Reset - Frantic', 'Flop Reset | Fracture']

function signed(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(1)}` }
function formLabel(value: number) { return value >= 15 ? 'Rising' : value <= -15 ? 'Falling' : 'Stable' }

export default async function PowerRankings({ searchParams }: { searchParams: Promise<{ competition?: string; format?: string; round?: string }> }) {
  const filters = await searchParams
  const { data: competitions = [] } = await supabase.from('competitions').select('*').order('start_date', { ascending: false })
  const activeFormat = filters.format === '2v2' ? '2v2' : '3v3'
  const compatible = (competitions ?? []).filter((competition: any) => competition.format === activeFormat)
  const requestedCompetition = compatible.find((competition: any) => String(competition.id) === filters.competition)
  const selectedCompetition = requestedCompetition ?? compatible.find((competition: any) => competition.status === 'active') ?? compatible[0] ?? null

  const scopeProbe = await supabase.from('league_matches').select('competition_id').limit(1)
  const competitionScoped = !scopeProbe.error
  let matchResult: { data: any[] | null; error: { message: string } | null }
  if (competitionScoped) {
    let query: any = supabase.from('league_matches').select('id, competition_id, format, round, tier, team_a, team_b, score_a, score_b, status, match_date, batch_label').eq('format', activeFormat)
    if (selectedCompetition) query = query.eq('competition_id', selectedCompetition.id)
    matchResult = await query
  } else {
    matchResult = await supabase.from('league_matches').select('id, format, round, tier, team_a, team_b, score_a, score_b, status, match_date, batch_label').eq('format', activeFormat) as any
  }
  const { data: rawMatches, error } = matchResult
  const allMatches = (rawMatches ?? []) as LeagueMatch[]
  const fullEngine = calculateEloWithHistory(allMatches)
  const requestedRound = Number.parseInt(filters.round ?? '', 10)
  const asOfRound = Number.isFinite(requestedRound) && fullEngine.rounds.includes(requestedRound) ? requestedRound : null
  const engine = asOfRound === null ? fullEngine : calculateEloWithHistory(allMatches.filter((match) => (Number.parseInt(match.round.replace(/\D/g, ''), 10) || 0) <= asOfRound))
  const { teamSummaries, teamRoundHistory } = engine
  const identity = selectedCompetition ? competitionIdentity(selectedCompetition) : null
  const queryString = new URLSearchParams({ format: activeFormat, ...(selectedCompetition ? { competition: String(selectedCompetition.id) } : {}), ...(asOfRound !== null ? { round: String(asOfRound) } : {}) }).toString()

  const flopSummaries = teamSummaries.filter((team) => FLOP_TEAMS.includes(team.team))
  const rankedTeams = teamSummaries.filter((team) => team.overallRank !== null)
  const biggestRankRiser = [...rankedTeams].sort((a, b) => b.rankMove - a.rankMove)[0]
  const biggestEloGainer = [...rankedTeams].sort((a, b) => b.lastRoundDelta - a.lastRoundDelta)[0]
  const teamOfRound = [...rankedTeams].sort((a, b) => b.teamOfRoundScore - a.teamOfRoundScore)[0]
  const giantKiller = [...rankedTeams].filter((team) => team.giantKillerUpsets > 0).sort((a, b) => b.giantKillerScore - a.giantKillerScore)[0]
  const singleUpset = [...rankedTeams].filter((team) => team.giantKillerUpsets > 0).sort((a, b) => b.giantKillerLargestGap - a.giantKillerLargestGap)[0]

  return <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-10 md:px-8 md:py-14">
    <header className="min-w-0 rounded-3xl border border-neutral-800 bg-gradient-to-br from-[#171717] to-[#0d0d0d] p-6 md:p-9">
      <div className="text-xs font-bold uppercase tracking-[.22em] text-purple-400">Canonical competitive strength</div>
      <h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">Power <span className="text-purple-400">Rankings</span></h1>
      <p className="mt-3 max-w-3xl text-neutral-400">One rating engine for rankings, historical strength, opponent intelligence, playoff context, and future FR Markets snapshots.</p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs text-neutral-500"><span>{identity ? `${identity.league} · ${identity.seasonLabel}` : 'Legacy imported league pool'}</span><span>•</span><span>{activeFormat}</span><span>•</span><span>{asOfRound === null ? 'Current' : `As of Round ${asOfRound}`}</span><span>•</span><span>Model {RATING_MODEL_VERSION}</span></div>
    </header>

    {!competitionScoped && <div className="mt-5 rounded-2xl border border-amber-800/70 bg-amber-950/20 p-4 text-sm text-amber-100"><div className="font-black uppercase tracking-[.16em]">Summer Circuit archive</div><p className="mt-1 text-amber-100/80">These historical rankings currently cover Summer Circuit 2026 only. A new circuit will remain separate until its results have been independently verified.</p></div>}

    <form className="mt-6 grid min-w-0 gap-3 rounded-2xl border border-neutral-800 bg-[#111] p-4 sm:grid-cols-3 lg:grid-cols-4">
      <FilterSelect label="Format" name="format" defaultValue={activeFormat}><option value="3v3">3v3</option><option value="2v2">2v2</option></FilterSelect>
      <label className="min-w-0 text-xs font-bold uppercase tracking-wide text-neutral-500">Competition<select name="competition" defaultValue={selectedCompetition?.id ?? ''} disabled={!competitionScoped} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-neutral-700 bg-[#181818] px-3 text-sm text-white disabled:opacity-50">{compatible.map((competition: any) => { const item = competitionIdentity(competition); return <option key={competition.id} value={competition.id}>{item.league} · {item.seasonLabel}</option> })}</select></label>
      <FilterSelect label="Rankings as of" name="round" defaultValue={asOfRound ?? ''}><option value="">Current</option>{fullEngine.rounds.map((round) => <option key={round} value={round}>After Round {round}</option>)}</FilterSelect>
      <button className="min-h-11 self-end rounded-lg bg-purple-700 px-4 text-sm font-black text-white">View rating pool</button>
    </form>

    {error && <p className="mt-6 rounded-xl border border-red-900 bg-red-950/20 p-4 text-red-300">Something went wrong while loading the ratings. Please try again shortly.</p>}
    {!error && !rankedTeams.length && <div className="mt-8 rounded-2xl border border-neutral-800 bg-[#111] p-6"><div className="font-black text-white">Power Rankings are awaiting the rebuilt league results.</div><p className="mt-2 text-sm text-neutral-500">Ratings will return after verified league results are reimported chronologically.</p></div>}

    {!!flopSummaries.length && <section className="mt-12"><Eyebrow>Home-club watch</Eyebrow><h2 className="mt-1 text-3xl font-black">Flop Reset Spotlight</h2><div className="mt-5 grid gap-4 md:grid-cols-3">{flopSummaries.map((team) => <Link key={team.team} href={`/power-rankings/team/${encodeURIComponent(team.team)}?${queryString}`} className="rounded-2xl border border-purple-800 bg-purple-950/20 p-5 no-underline transition hover:border-purple-500"><div className="text-lg font-black text-white">{team.team}</div><div className="mt-4 grid grid-cols-2 gap-4 text-sm"><Metric label="Rating" value={Math.round(team.rating)} /><Metric label="Overall" value={`#${team.overallRank}`} /><Metric label="Last Round" value={signed(team.lastRoundDelta)} /><Metric label="Last 3" value={signed(team.threeRoundDelta)} /><Metric label="SOS" value={team.sosFull ? `#${team.sosRank} / ${team.sosTierSize}` : '—'} /><Metric label="Sample" value={team.confidence} /></div><div className="mt-4 flex gap-1" aria-label={`Recent form ${team.recentForm.join(' ')}`}>{team.recentForm.map((result, index) => <span key={index} className={`rounded px-2 py-1 text-xs font-black ${result === 'W' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>{result}</span>)}</div></Link>)}</div></section>}

    {!!rankedTeams.length && <><section className="mt-12"><Eyebrow>This round</Eyebrow><h2 className="mt-1 text-3xl font-black">What Changed?</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Award label="Biggest Rank Riser" team={biggestRankRiser} detail={biggestRankRiser ? `${biggestRankRiser.rankMove >= 0 ? '+' : ''}${biggestRankRiser.rankMove} places` : '—'} /><Award label="Biggest Elo Gainer" team={biggestEloGainer} detail={biggestEloGainer ? `${signed(biggestEloGainer.lastRoundDelta)} Elo` : '—'} /><Award label="Team of the Round" team={teamOfRound} detail="Elo gain + rank movement + result surprise" /><Award label="Biggest Single Upset" team={singleUpset} detail={singleUpset ? `+${singleUpset.giantKillerLargestGap.toFixed(0)} pre-match Elo gap` : 'No qualifying upset'} /></div></section>
      {giantKiller && <section className="mt-8 rounded-2xl border border-neutral-800 bg-[#111] p-5"><Eyebrow>Season Giant Killer</Eyebrow><div className="mt-2 text-2xl font-black">{giantKiller.team}</div><div className="mt-3 flex flex-wrap gap-5 text-sm text-neutral-400"><span><strong className="text-white">{giantKiller.giantKillerUpsets}</strong> upsets</span><span>Largest gap <strong className="text-white">{giantKiller.giantKillerLargestGap.toFixed(0)}</strong></span><span>Cumulative gap <strong className="text-white">{giantKiller.giantKillerScore.toFixed(0)}</strong></span></div></section>}
      <PowerHistoryChart history={teamRoundHistory} teams={rankedTeams.map((team) => team.team)} />
      <PowerRankingsTable rows={rankedTeams} queryString={queryString} />
    </>}

    <details className="mt-12 rounded-2xl border border-neutral-800 bg-[#111] p-5"><summary className="cursor-pointer font-black text-white">How the rating works</summary><div className="mt-4 grid gap-4 text-sm text-neutral-400 md:grid-cols-2"><p><strong className="text-white">Rating pools:</strong> a competition/circuit and format form one independent pool. Raw Elo from separately seeded pools is not directly comparable.</p><p><strong className="text-white">Tier seed:</strong> a team starts at its tier seed. Early results move faster through a higher K-factor.</p><p><strong className="text-white">Expected result:</strong> opponent pre-match Elo sets the expected win chance. Upsets therefore move ratings more.</p><p><strong className="text-white">Margin:</strong> non-forfeit score margin is compared with the normal margin for that tier and round, with a capped multiplier.</p><p><strong className="text-white">Forfeits:</strong> the existing rule is preserved: half K-factor and no margin multiplier. They count officially but never qualify for performance awards. Zero movement remains recommended for future review.</p><p><strong className="text-white">Schedule strength:</strong> average opponent Elo before each played match; recent SOS uses the latest five performance results.</p><p><strong className="text-white">Adjusted form:</strong> average actual result minus expected result. Positive means the team exceeded model expectation.</p><p><strong className="text-white">Limits:</strong> ratings represent tracked league results only. {engine.duplicateCount} duplicate row{engine.duplicateCount === 1 ? '' : 's'} excluded in this view.</p></div></details>
  </main>
}

function FilterSelect({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) { return <label className="min-w-0 text-xs font-bold uppercase tracking-wide text-neutral-500">{label}<select {...props} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-neutral-700 bg-[#181818] px-3 text-sm text-white">{children}</select></label> }
function Eyebrow({ children }: { children: React.ReactNode }) { return <div className="text-xs font-black uppercase tracking-[.22em] text-purple-400">{children}</div> }
function Metric({ label, value }: { label: string; value: string | number }) { return <div><div className="text-xs uppercase text-neutral-500">{label}</div><div className="mt-1 font-black text-white">{value}</div></div> }
function Award({ label, team, detail }: { label: string; team: { team: string; threeRoundDelta: number } | undefined; detail: string }) { return <div className="rounded-2xl border border-neutral-800 bg-[#111] p-4"><div className="text-xs uppercase text-neutral-500">{label}</div><div className="mt-1 font-black text-white">{team?.team ?? 'Not available'}</div><div className="mt-1 text-sm text-purple-300">{detail}</div>{team && <div className="mt-2 text-xs text-neutral-600">{formLabel(team.threeRoundDelta)} over three rounds</div>}</div> }
