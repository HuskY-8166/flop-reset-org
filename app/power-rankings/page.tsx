/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase'
import { calculateEloWithHistory } from '@/lib/elo'
export const dynamic = 'force-dynamic'

const FLOP_TEAMS = ['Flop Reset Frameshift', 'Flop Reset - Frantic', 'Flop Reset | Fracture']
const FLOP_TEAM_SLUGS: Record<string, string> = {
  'Flop Reset Frameshift': 'Frameshift',
  'Flop Reset - Frantic': 'Frantic',
  'Flop Reset | Fracture': 'Fracture',
}

export default async function PowerRankings({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  const { format } = await searchParams
  const activeFormat = format === '2v2' ? '2v2' : '3v3'

  const { data: matches, error } = await supabase
    .from('league_matches')
    .select('round, tier, team_a, team_b, score_a, score_b, status, match_date')
    .eq('format', activeFormat)

  const { teamSummaries, rounds } = matches
    ? calculateEloWithHistory(matches as any)
    : { teamSummaries: [], rounds: [] }

  const latestRound = rounds[rounds.length - 1]
  const flopSummaries = teamSummaries.filter((t) => FLOP_TEAMS.includes(t.team))
  const others = teamSummaries.filter((t) => !FLOP_TEAMS.includes(t.team) && t.overallRank !== null)

  const biggestRiser = [...others].sort((a, b) => b.rankMove - a.rankMove)[0]
  const biggestFaller = [...others].sort((a, b) => a.rankMove - b.rankMove)[0]
  const eloSurge = [...teamSummaries].sort((a, b) => b.lastRoundDelta - a.lastRoundDelta)[0]
  const teamOfRound = [...teamSummaries].sort((a, b) => b.teamOfRoundScore - a.teamOfRoundScore)[0]
  const giantKiller = [...teamSummaries].filter((team) => team.giantKillerScore > 0).sort((a, b) => b.giantKillerScore - a.giantKillerScore)[0]

  const rankedTeams = teamSummaries.filter((t) => t.overallRank !== null)
  const byTier: Record<string, typeof rankedTeams> = {}
  rankedTeams.forEach((r) => {
    byTier[r.tier] = byTier[r.tier] || []
    byTier[r.tier].push(r)
  })
  const tierOrder = Object.keys(byTier).sort()

  function moveArrow(move: number) {
    if (move > 0) return <span className="text-emerald-400">▲{move}</span>
    if (move < 0) return <span className="text-red-400">▼{Math.abs(move)}</span>
    return <span className="text-neutral-500">—</span>
  }

  return (
    <main className="px-4 py-10 md:px-8 md:py-14 max-w-7xl mx-auto">
      <div className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-[#171717] to-[#0d0d0d] p-6 md:p-9 mb-8">
        <div className="text-xs font-bold uppercase tracking-[.22em] text-purple-400">Competitive form</div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mt-2">Power <span style={{ color: '#AF69EE' }}>Rankings</span></h1>
        <p className="text-neutral-400 mt-2 max-w-3xl">Elo-based team strength from completed league results. Ratings update after each tracked result, remain separated by format, and apply half-weight movement to forfeits.</p>
        <div className="mt-5 rounded-2xl border border-amber-800/70 bg-amber-950/20 p-4 text-sm text-amber-100">
          <div className="font-black uppercase tracking-[.16em]">Legacy ranking scope</div>
          <p className="mt-1 text-amber-100/80">These imported rankings are format-scoped but are not yet linked to a circuit. Treat this as the Summer Circuit 2026 archive only. A prepared database upgrade adds circuit ownership before Fall Circuit imports begin, so Summer and Fall ratings cannot be mixed.</p>
        </div>
        <div className="mt-4 text-sm text-neutral-500">Latest completed round: <span className="font-semibold text-white">{latestRound ?? 'Not available'}</span></div>
      </div>

      <div className="flex gap-2 mb-10">
        <a href="?format=3v3" className={`rounded-full px-4 py-2 text-sm font-semibold no-underline ${activeFormat === '3v3' ? 'bg-purple-700 text-white' : 'border border-neutral-800 bg-[#151515] text-neutral-400'}`}>3v3</a>
        <a href="?format=2v2" className={`rounded-full px-4 py-2 text-sm font-semibold no-underline ${activeFormat === '2v2' ? 'bg-purple-700 text-white' : 'border border-neutral-800 bg-[#151515] text-neutral-400'}`}>2v2</a>
      </div>

      {error && <p>Error: {error.message}</p>}
      {teamSummaries.length === 0 && <p className="text-neutral-500">No match data imported for this format yet.</p>}

      {flopSummaries.length > 0 && (
        <>
          <h2 className="text-2xl font-bold mb-4">Flop Reset Spotlight</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {flopSummaries.map((t) => (
              <div key={t.team} className="rounded-xl bg-purple-950/40 border border-purple-800 p-5">
                <a href={`/teams/${encodeURIComponent(FLOP_TEAM_SLUGS[t.team])}`} className="font-bold text-lg mb-3 inline-block text-white hover:underline">{t.team}</a>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-neutral-400">Overall Rank</div>
                    <div className="text-xl font-bold">#{t.overallRank} {moveArrow(t.rankMove)}</div>
                  </div>
                  <div>
                    <div className="text-neutral-400">Elo Rating</div>
                    <div className="text-xl font-bold">{Math.round(t.rating)}</div>
                    <div className={t.lastRoundDelta >= 0 ? 'text-emerald-400 text-xs' : 'text-red-400 text-xs'}>
                      {t.lastRoundDelta >= 0 ? '+' : ''}{t.lastRoundDelta.toFixed(1)} this round
                    </div>
                  </div>
                  <div>
                    <div className="text-neutral-400">Tier</div>
                    <div className="font-bold">{t.tier} · rank #{t.tierRank}</div>
                  </div>
                  <div>
                    <div className="text-neutral-400">Peak / Worst</div>
                    <div className="font-bold">{Math.round(t.peak)} / {Math.round(t.worst)}</div>
                  </div>
                  <div>
                    <div className="text-neutral-400">Matches Tracked</div>
                    <div className="font-bold">{t.matchesTracked}</div>
                  </div>
                  <div>
                    <div className="text-neutral-400">Best / Worst Match</div>
                    <div className="font-bold">+{t.bestMatch.toFixed(0)} / {t.worstMatch.toFixed(0)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-2xl font-bold mb-4">Biggest Movers</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        {biggestRiser && (
          <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
            <div className="text-sm text-neutral-400">🔥 Biggest Riser</div>
            <div className="font-bold">{biggestRiser.team}</div>
            <div className="text-emerald-400">▲{biggestRiser.rankMove} positions</div>
          </div>
        )}
        {biggestFaller && (
          <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
            <div className="text-sm text-neutral-400">📉 Biggest Faller</div>
            <div className="font-bold">{biggestFaller.team}</div>
            <div className="text-red-400">▼{Math.abs(biggestFaller.rankMove)} positions</div>
          </div>
        )}
        {eloSurge && (
          <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
            <div className="text-sm text-neutral-400">⚡ Elo Surge</div>
            <div className="font-bold">{eloSurge.team}</div>
            <div className="text-emerald-400">+{eloSurge.lastRoundDelta.toFixed(0)} Elo</div>
          </div>
        )}
      </div>

      <h2 className="text-2xl font-bold mb-4">Round Awards</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        {teamOfRound && (
          <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
            <div className="text-sm text-neutral-400">🏆 Team of the Round</div>
            <div className="font-bold">{teamOfRound.team}</div>
          </div>
        )}
        {giantKiller && (
          <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
            <div className="text-sm text-neutral-400">🐉 Giant Killer · season to date</div>
            <div className="font-bold">{giantKiller.team}</div>
            <div className="text-neutral-400 text-sm">{giantKiller.giantKillerScore.toFixed(0)} cumulative pre-match Elo gap defeated</div>
          </div>
        )}
      </div>

      <h2 className="text-2xl font-bold mb-4">Full Tier Rankings</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tierOrder.map((tier) => (
          <div key={tier} className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
            <h3 className="font-bold mb-3 border-b border-neutral-800 pb-2">{tier}</h3>
            <div className="space-y-1">
              {byTier[tier]
                .sort((a, b) => b.rating - a.rating)
                .map((r, i) => {
                  const isUs = FLOP_TEAMS.includes(r.team)
                  return (
                    <div
                      key={r.team}
                      className={`flex justify-between items-center px-2 py-1 rounded text-sm ${isUs ? 'bg-purple-950 border border-purple-700' : ''}`}
                    >
                      <span className={isUs ? 'font-bold text-purple-300' : 'text-neutral-300'}>
                        {i + 1}. {isUs ? (
                          <a href={`/teams/${encodeURIComponent(FLOP_TEAM_SLUGS[r.team])}`} className="hover:underline">
                            {r.team}
                          </a>
                        ) : r.team}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-neutral-500">{Math.round(r.rating)}</span>
                        <span className="text-xs">{moveArrow(r.rankMove)}</span>
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        ))}
      </div>

      <details className="mt-12 rounded-2xl border border-neutral-800 bg-[#111111] p-5">
        <summary className="cursor-pointer font-bold text-white">How the rating works</summary>
        <div className="mt-4 grid gap-4 text-sm text-neutral-400 md:grid-cols-2">
          <p><strong className="text-white">What raises a rating:</strong> beating a higher-rated opponent and winning by more than the typical margin for that tier and round.</p>
          <p><strong className="text-white">What lowers a rating:</strong> losing—especially to a lower-rated opponent. Early matches move ratings faster through a larger K-factor.</p>
          <p><strong className="text-white">Starting point:</strong> teams begin from a tier-based seed. Rankings therefore combine tier context with completed results.</p>
          <p><strong className="text-white">Round movement:</strong> the displayed round delta is the sum of every rating change a team records in that round, not merely its final match.</p>
          <p><strong className="text-white">Giant Killer:</strong> season-to-date credit sums the pre-match rating gap only when a lower-rated team beats a higher-rated opponent. Forfeits do not qualify.</p>
          <p><strong className="text-white">Data rules:</strong> 2v2 and 3v3 are calculated separately. Incomplete fixtures are excluded; forfeits use half the normal K-factor and no score-margin multiplier.</p>
        </div>
      </details>
    </main>
  )
}
