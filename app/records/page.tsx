import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  PROCESS_SKILLS,
  buildProcessSkillResults,
  formatProcessSkillValue,
  getEligibilityThreshold,
  rankProcessSkill,
  type ProcessPlayer,
} from '@/lib/processSkills'
import { getGameOutcome } from '@/lib/results'

export const dynamic = 'force-dynamic'

type Stat = {
  stat_id: number; player_id: number; goals: number | null; assists: number | null
  saves: number | null; shots: number | null; score: number | null; mvp: boolean | null
  bpm: number | null; avg_speed: number | null; demos_inflicted: number | null
  demos_taken: number | null; boost_collected: number | null; boost_stolen: number | null
  percentage_supersonic_speed: number | null; percentage_on_ground: number | null
  percentage_low_air: number | null; percentage_high_air: number | null
  percentage_defensive_third: number | null; percentage_neutral_third: number | null
  percentage_offensive_third: number | null; percentage_most_back: number | null
  percentage_most_forward: number | null; percentage_behind_ball: number | null
  percentage_in_front_of_ball: number | null; percentage_defensive_half: number | null
  percentage_offensive_half: number | null; avg_distance_to_ball: number | null
  avg_distance_to_ball_has_possession: number | null
  avg_distance_to_ball_no_possession: number | null; avg_distance_to_teammates: number | null
  zero_boost_pct: number | null
  players: { name: string | null } | null
  matches: { match_id: number; match_date: string | null; opponent_name: string | null
    flop_reset_score: number | null; opponent_score: number | null; series_id: number | null
    is_forfeit: boolean | null; forfeit_result?: string | null; result_override?: string | null
    teams: { name: string | null; format: string | null } | null } | null
}

type Series = { series_id: number; opponent_name: string | null; series_date: string | null
  teams: { name: string | null; format: string | null } | null
  matches: { match_id: number; flop_reset_score: number | null; opponent_score: number | null
    is_forfeit: boolean | null; forfeit_result?: string | null; result_override?: string | null }[] | null }

type Career = { id: string; name: string; team: string; format: string; games: number; goals: number
  assists: number; saves: number; shots: number; score: number; mvps: number; bpm: number
  speed: number; bpmN: number; speedN: number }

type Holder = { id: string; name: string; team: string; format: string; opponent?: string
  date?: string; value: number; games?: number; sample?: number; our?: number; their?: number
  wins?: number; losses?: number; rank?: number; distance?: string; context?: string
  previousValue?: number; previousNames?: string[]; profileLink?: boolean }

type BookRecord = { label: string; value: string; holders: Holder[]; note?: string; leaderboard?: boolean }

const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0
const has = (v: unknown) => v !== null && v !== undefined && v !== ''
const avg = (a: number, b: number) => b ? a / b : 0
const percent = (v: number) => `${v.toFixed(1)}%`
const fmtDate = (v?: string) => !v ? 'Date unavailable' : new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${v.slice(0, 10)}T00:00:00Z`))
const fmt = (v: number, type: 'int' | 'rate' | 'pct' = 'int') =>
  type === 'rate' ? v.toFixed(2) : type === 'pct' ? percent(v) : Math.round(v).toLocaleString()

function tied<T>(rows: T[], value: (row: T) => number, lower = false) {
  if (!rows.length) return []
  const target = lower ? Math.min(...rows.map(value)) : Math.max(...rows.map(value))
  return rows.filter((row) => value(row) === target)
}

function ranked<T>(rows: T[], value: (row: T) => number, lower = false) {
  const sorted = [...rows].sort((a,b) => lower ? value(a) - value(b) : value(b) - value(a))
  let prior: number | null = null, priorRank = 0
  return sorted.map((row, index) => {
    const current = value(row), rank = prior !== null && current === prior ? priorRank : index + 1
    prior = current; priorRank = rank
    return { row, rank, value: current }
  })
}

function careerRows(stats: Stat[]) {
  const map = new Map<string, Career>()
  for (const s of stats) {
    const name = s.players?.name ?? 'Unknown', team = s.matches?.teams?.name ?? 'Unknown'
    const format = s.matches?.teams?.format ?? 'Unknown', id = `${name.toLowerCase()}|${team.toLowerCase()}|${format}`
    const r = map.get(id) ?? { id, name, team, format, games: 0, goals: 0, assists: 0,
      saves: 0, shots: 0, score: 0, mvps: 0, bpm: 0, speed: 0, bpmN: 0, speedN: 0 }
    r.games++; r.goals += num(s.goals); r.assists += num(s.assists); r.saves += num(s.saves)
    r.shots += num(s.shots); r.score += num(s.score); r.mvps += s.mvp ? 1 : 0
    if (has(s.bpm)) { r.bpm += num(s.bpm); r.bpmN++ }
    if (has(s.avg_speed)) { r.speed += num(s.avg_speed); r.speedN++ }
    map.set(id, r)
  }
  return [...map.values()]
}

function holder(r: Career, value: number, sample?: number): Holder {
  return { id: r.id, name: r.name, team: r.team, format: r.format, value, games: r.games, sample }
}

function RecordCard({ record }: { record: BookRecord }) {
  const renderHolder = (h: Holder) => {
    const result = h.our === undefined ? '' : `${h.our > (h.their ?? 0) ? 'W' : h.our < (h.their ?? 0) ? 'L' : 'T'} ${h.our}–${h.their}`
    return <div key={h.id} className="border-t border-neutral-800 pt-3 first:border-0 first:pt-0">
      {h.rank && <span className="mr-2 text-lg" aria-label={`Rank ${h.rank}`}>{h.rank === 1 ? '🥇' : h.rank === 2 ? '🥈' : h.rank === 3 ? '🥉' : `#${h.rank}`}</span>}
      {h.profileLink === false ? <span className="font-bold text-white">{h.name}</span> : <Link href={`/players/${encodeURIComponent(h.name)}`} className="font-bold text-white hover:text-purple-300 hover:underline">{h.name}</Link>}
      {record.leaderboard && <span className="float-right font-mono font-bold text-purple-300">{fmt(h.value, record.label.includes('%') ? 'pct' : record.label.includes('Per Game') || record.label.includes('Avg BPM') ? 'rate' : 'int')}</span>}
      <div className="mt-1 text-xs text-neutral-500">{h.team} · {h.format}{h.context ? ` · ${h.context}` : ''}</div>
      {(h.opponent || result) && <div className="mt-2 text-sm text-neutral-400">{h.opponent ? `vs ${h.opponent}` : ''}{h.opponent && result ? ' · ' : ''}{result}</div>}
      <div className="mt-1 text-xs text-neutral-600">{h.date ? fmtDate(h.date) : ''}{h.games !== undefined ? ` · ${h.games} Games` : ''}{h.sample !== undefined ? ` · ${h.sample} tracked` : ''}{h.wins !== undefined ? ` · Series ${h.wins! > h.losses! ? 'W' : h.wins! < h.losses! ? 'L' : 'T'} ${h.wins}–${h.losses}` : ''}</div>
      {h.distance && <div className="mt-1 text-xs text-amber-400/70">{h.distance}</div>}
    </div>
  }
  return <article className="rounded-2xl border border-neutral-800 bg-[#111] p-5 shadow-xl shadow-black/10">
    <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">{record.label}</div>
    <div className="mt-2 text-4xl font-black text-[#AF69EE]">{record.value}</div>
    <div className="mt-5 space-y-3">{!record.holders.length ? <p className="text-sm text-neutral-600">No reliable data in this format yet.</p>
      : !record.leaderboard && record.holders.length > 1 ? <details><summary className="cursor-pointer text-sm font-semibold text-purple-300">{record.holders.length} performances tied · View performances</summary><div className="mt-4 space-y-3">{record.holders.map(renderHolder)}</div></details>
      : record.holders.map(renderHolder)}</div>
    {record.note && <p className="mt-4 border-t border-neutral-800 pt-3 text-xs text-neutral-600">{record.note}</p>}
  </article>
}

function Heading({ overline, title, copy }: { overline: string; title: string; copy: string }) {
  return <div className="mb-5"><div className="text-xs font-bold uppercase tracking-[.22em] text-purple-400">{overline}</div>
    <h2 className="mt-2 text-3xl font-black text-white">{title}</h2><p className="mt-2 max-w-3xl text-sm text-neutral-500">{copy}</p></div>
}

function makeProcessPlayer(row: Career, stats: Stat[]): ProcessPlayer {
  const real = (key: keyof Stat) => stats.filter((s) => has(s[key]))
  const mean = (key: keyof Stat) => { const rows = real(key); return avg(rows.reduce((a, s) => a + num(s[key]), 0), rows.length) }
  const demos = stats.filter((s) => has(s.demos_inflicted) || has(s.demos_taken))
  const boost = stats.filter((s) => has(s.boost_collected) || has(s.boost_stolen))
  const positionN = Math.min(real('percentage_defensive_third').length, real('percentage_behind_ball').length, real('percentage_most_back').length, real('percentage_defensive_half').length)
  const airN = Math.min(real('percentage_low_air').length, real('percentage_high_air').length)
  return { playerId: stats[0]?.player_id ?? 0, name: row.name, team: row.team, format: row.format,
    games: row.games, goals: row.goals, assists: row.assists, saves: row.saves, shots: row.shots,
    bpm: mean('bpm'), avgSpeed: mean('avg_speed'),
    demosInflicted: demos.reduce((a, s) => a + num(s.demos_inflicted), 0), demosTaken: demos.reduce((a, s) => a + num(s.demos_taken), 0),
    boostCollected: boost.reduce((a, s) => a + num(s.boost_collected), 0), boostStolen: boost.reduce((a, s) => a + num(s.boost_stolen), 0),
    supersonicPct: mean('percentage_supersonic_speed'), groundPct: mean('percentage_on_ground'), lowAirPct: mean('percentage_low_air'), highAirPct: mean('percentage_high_air'),
    defensiveThirdPct: mean('percentage_defensive_third'), neutralThirdPct: mean('percentage_neutral_third'), offensiveThirdPct: mean('percentage_offensive_third'),
    mostBackPct: mean('percentage_most_back'), mostForwardPct: mean('percentage_most_forward'), behindBallPct: mean('percentage_behind_ball'), inFrontOfBallPct: mean('percentage_in_front_of_ball'),
    defensiveHalfPct: mean('percentage_defensive_half'), offensiveHalfPct: mean('percentage_offensive_half'), avgDistanceToBall: mean('avg_distance_to_ball'),
    avgDistanceToBallHasPossession: mean('avg_distance_to_ball_has_possession'), avgDistanceToBallNoPossession: mean('avg_distance_to_ball_no_possession'), avgDistanceToTeammates: mean('avg_distance_to_teammates'), zeroBoostPct: mean('zero_boost_pct'),
    dataAvailability: { demoEfficiency: demos.length > 0, shotQuality: row.shots > 0, boostStealRate: boost.length > 0, bpm: real('bpm').length > 0,
      avgSpeed: real('avg_speed').length > 0, supersonicPct: real('percentage_supersonic_speed').length > 0,
      positioningDepth: positionN > 0, airTimePct: airN > 0, zeroBoostPct: real('zero_boost_pct').length > 0 } }
}

export default async function Records({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  const query = await searchParams
  const [{ data: rawStats }, { data: rawSeries }] = await Promise.all([
    supabase.from('match_player_stats').select(`stat_id, player_id, goals, assists, saves, shots, score, mvp, bpm, avg_speed,
      demos_inflicted, demos_taken, boost_collected, boost_stolen, percentage_supersonic_speed, percentage_on_ground,
      percentage_low_air, percentage_high_air, percentage_defensive_third, percentage_neutral_third, percentage_offensive_third,
      percentage_most_back, percentage_most_forward, percentage_behind_ball, percentage_in_front_of_ball,
      percentage_defensive_half, percentage_offensive_half, avg_distance_to_ball, avg_distance_to_ball_has_possession,
      avg_distance_to_ball_no_possession, avg_distance_to_teammates, zero_boost_pct,
      players ( name ), matches ( match_id, match_date, opponent_name, flop_reset_score, opponent_score, series_id, is_forfeit, teams ( name, format ) )`),
    supabase.from('series').select(`series_id, opponent_name, series_date, teams ( name, format ), matches ( * )`),
  ])
  const allStats = (rawStats ?? []) as unknown as Stat[], allSeries = (rawSeries ?? []) as unknown as Series[]
  const formats = [...new Set(allStats.map((s) => s.matches?.teams?.format ?? '').filter(Boolean))].sort()
  const selected = query.format && formats.includes(query.format) ? query.format : 'All'
  const inFormat = (format?: string | null) => selected === 'All' || selected === format
  const stats = allStats.filter((s) => inFormat(s.matches?.teams?.format)), series = allSeries.filter((s) => inFormat(s.teams?.format))
  const competitive = stats.filter((s) => !s.matches?.is_forfeit), careers = careerRows(competitive)
  const threshold = getEligibilityThreshold(careers), eligible = careers.filter((r) => r.games >= threshold)

  const careerDefs = [
    ['Career Goals', (r: Career) => r.goals, 'int'], ['Career Assists', (r: Career) => r.assists, 'int'],
    ['Career Saves', (r: Career) => r.saves, 'int'], ['Career Shots', (r: Career) => r.shots, 'int'],
    ['Career Score', (r: Career) => r.score, 'int'], ['Career MVPs', (r: Career) => r.mvps, 'int'],
    ['Goals Per Game', (r: Career) => avg(r.goals, r.games), 'rate', true],
    ['Assists Per Game', (r: Career) => avg(r.assists, r.games), 'rate', true],
    ['Saves Per Game', (r: Career) => avg(r.saves, r.games), 'rate', true],
    ['Shooting Percentage', (r: Career) => avg(r.goals * 100, r.shots), 'pct', true, 'shots'],
    ['Career Avg BPM', (r: Career) => avg(r.bpm, r.bpmN), 'rate', true, 'bpmN'],
    ['Career Avg Speed', (r: Career) => avg(r.speed, r.speedN), 'int', true, 'speedN'],
  ] as const
  const careerRecords: BookRecord[] = careerDefs.map(([label, value, kind, rates, sample]) => {
    const pool = (rates ? eligible : careers).filter((r) => (!sample || r[sample] > 0) && value(r) > 0)
    const leaders = ranked(pool, value).filter((entry) => entry.rank <= 3)
    const record = leaders[0]?.value ?? 0
    return { label, value: leaders.length ? fmt(record, kind) : '—', leaderboard: true,
      holders: leaders.map(({ row, rank, value: current }) => ({
        ...holder(row, current, sample === 'bpmN' ? row.bpmN : sample === 'speedN' ? row.speedN : undefined), rank,
        context: label === 'Shooting Percentage' ? `${row.goals} Goals / ${row.shots} Shots` : undefined,
        distance: rank === 1 ? undefined : kind === 'pct' ? `${(record-current).toFixed(1)} percentage points from record` : kind === 'rate' ? `${(record-current).toFixed(2)} from record` : `${Math.round(record-current)} from record`,
      })), note: leaders.length ? (rates ? `Eligible · Minimum: ${threshold} GP (20% of the format maximum).` : undefined) : `No positive ${label.toLowerCase()} value recorded yet.` }
  })

  const gameDefs = [
    ['Most Goals — Single Game', 'goals'], ['Most Assists — Single Game', 'assists'], ['Most Saves — Single Game', 'saves'],
    ['Most Shots — Single Game', 'shots'], ['Highest Score — Single Game', 'score'], ['Highest BPM — Single Game', 'bpm'],
    ['Fastest Avg Speed — Single Game', 'avg_speed'], ['Most Demos Inflicted — Single Game', 'demos_inflicted'], ['Most Boost Stolen — Single Game', 'boost_stolen'],
  ] as const
  const performance = (s: Stat, value: number): Holder => ({ id: String(s.stat_id), name: s.players?.name ?? 'Unknown', team: s.matches?.teams?.name ?? 'Unknown',
    format: s.matches?.teams?.format ?? 'Unknown', opponent: s.matches?.opponent_name ?? 'Unknown', date: s.matches?.match_date ?? '', value,
    our: num(s.matches?.flop_reset_score), their: num(s.matches?.opponent_score) })
  const gameRecords: BookRecord[] = gameDefs.map(([label, key]) => {
    const pool = competitive.filter((s) => (['bpm','avg_speed','demos_inflicted','boost_stolen'].includes(key) ? has(s[key]) : true) && num(s[key]) > 0), win = tied(pool, (s) => num(s[key]))
    return { label, value: win.length ? fmt(num(win[0][key]), key === 'bpm' ? 'rate' : 'int') : '—', holders: win.map((s) => performance(s, num(s[key]))), note: win.length ? undefined : 'No positive performance recorded yet.' }
  })

  const seriesMap = new Map<string, Holder & { goals: number; assists: number; saves: number; shots: number; score: number }>()
  for (const s of competitive) {
    if (s.matches?.series_id == null) continue
    const id = `${s.matches.series_id}|${s.player_id}`, r = seriesMap.get(id) ?? { ...performance(s, 0), id, our: undefined, their: undefined, games: 0, wins: 0, losses: 0, goals: 0, assists: 0, saves: 0, shots: 0, score: 0 }
    r.games!++; r.goals += num(s.goals); r.assists += num(s.assists); r.saves += num(s.saves); r.shots += num(s.shots); r.score += num(s.score)
    const outcome = getGameOutcome(s.matches)
    if (outcome.result === 'W') r.wins!++; else if (outcome.result === 'L') r.losses!++
    seriesMap.set(id, r)
  }
  const seriesRows = [...seriesMap.values()]
  const seriesDefs = [
    ['Most Goals in a Series', (r: typeof seriesRows[number]) => r.goals, 'int'], ['Most Assists in a Series', (r: typeof seriesRows[number]) => r.assists, 'int'],
    ['Most Saves in a Series', (r: typeof seriesRows[number]) => r.saves, 'int'], ['Most Shots in a Series', (r: typeof seriesRows[number]) => r.shots, 'int'],
    ['Highest Total Score in a Series', (r: typeof seriesRows[number]) => r.score, 'int'],
    ['Highest G/GP in a Series', (r: typeof seriesRows[number]) => avg(r.goals, r.games!), 'rate'],
    ['Highest A/GP in a Series', (r: typeof seriesRows[number]) => avg(r.assists, r.games!), 'rate'],
    ['Highest SV/GP in a Series', (r: typeof seriesRows[number]) => avg(r.saves, r.games!), 'rate'],
    ['Best Eligible Shooting % in a Series', (r: typeof seriesRows[number]) => avg(r.goals * 100, r.shots), 'pct'],
  ] as const
  const seriesRecords: BookRecord[] = seriesDefs.map(([label, value, kind]) => {
    const efficiency = label.includes('/GP') || label.startsWith('Best')
    const pool = seriesRows.filter((r) => (!efficiency || (r.games! >= 3 && (!label.startsWith('Best') || r.shots > 0))) && value(r) > 0)
    const win = tied(pool, value)
    return { label, value: win.length ? fmt(value(win[0]), kind) : '—', holders: win,
      note: efficiency ? 'Minimum: 3 games in the series.' : win.length ? undefined : 'No positive series performance recorded yet.' }
  })

  const games = series.flatMap((s) => (s.matches ?? []).map((m) => ({ ...m, series: s }))).filter((g) => !g.is_forfeit)
  const teamPerf = (g: typeof games[number], value: number): Holder => ({ id: `team-${g.match_id}`, name: g.series.teams?.name ?? 'Flop Reset', team: 'Team record', format: g.series.teams?.format ?? 'Unknown', opponent: g.series.opponent_name ?? 'Unknown', date: g.series.series_date ?? '', value, our: num(g.flop_reset_score), their: num(g.opponent_score), profileLink: false })
  const blowouts = tied(games.filter((g) => num(g.flop_reset_score) > num(g.opponent_score)), (g) => num(g.flop_reset_score) - num(g.opponent_score)), scoring = tied(games, (g) => num(g.flop_reset_score))
  const teamRecords: BookRecord[] = [{ label: 'Biggest Game Win', value: blowouts.length ? `+${num(blowouts[0].flop_reset_score) - num(blowouts[0].opponent_score)}` : '—', holders: blowouts.map((g) => teamPerf(g, num(g.flop_reset_score) - num(g.opponent_score))) }, { label: 'Most Team Goals in One Game', value: scoring.length ? String(num(scoring[0].flop_reset_score)) : '—', holders: scoring.map((g) => teamPerf(g, num(g.flop_reset_score))) }]

  const process = (selected === 'All' ? formats : [selected]).flatMap((format) => {
    const fs = competitive.filter((s) => s.matches?.teams?.format === format), rows = careerRows(fs)
    const players = rows.map((r) => makeProcessPlayer(r, fs.filter((s) => s.players?.name?.toLowerCase() === r.name.toLowerCase() && s.matches?.teams?.name === r.team)))
    const results = buildProcessSkillResults(players)
    return PROCESS_SKILLS.map((skill) => { const ranked = rankProcessSkill(results, skill.key), gold = ranked.filter((r) => r.rank === 1); return { format, skill, threshold: getEligibilityThreshold(players), gold, value: gold.length ? formatProcessSkillValue(skill.key, gold[0][skill.key]) : '—' } })
  })

  const chronological = [...competitive].filter((s) => s.matches?.match_date).sort((a,b) => (a.matches?.match_date ?? '').localeCompare(b.matches?.match_date ?? ''))
  const timeline: (Holder & { category: string; status: string; jointNames: string[] })[] = []
  const meaningfulMinimums = [2, 2, 3, 4, 300]
  for (const [definitionIndex, [label, key]] of gameDefs.slice(0,5).entries()) {
    let best = 0
    let currentNames: string[] = []
    const byDate = new Map<string, Stat[]>()
    for (const s of chronological) {
      const date = s.matches!.match_date!.slice(0,10)
      byDate.set(date, [...(byDate.get(date) ?? []), s])
    }
    for (const [, day] of byDate) {
      const dayBest = Math.max(...day.map((s) => num(s[key])))
      if (dayBest <= best || dayBest < meaningfulMinimums[definitionIndex]) continue
      const previousValue = best, previousNames = currentNames
      const setters = day.filter((s) => num(s[key]) === dayBest)
      currentNames = [...new Set(setters.map((s) => s.players?.name ?? 'Unknown'))]
      const representative = performance(setters[0], dayBest)
      timeline.push({ ...representative, id: `${label}-${representative.date}`, name: currentNames.join(' & '), jointNames: currentNames,
        category: label.replace(' — Single Game',''), status: 'NEW RECORD', previousValue: previousValue || undefined,
        previousNames: previousValue ? previousNames : undefined })
      best = dayBest
    }
  }
  timeline.sort((a,b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const uniqueGames = new Set(allSeries.flatMap((row) => row.matches ?? []).map((match) => match.match_id)).size
  const uniquePlayers = new Set(allStats.map((s) => s.players?.name).filter(Boolean)).size
  const uniqueTeams = new Set(allStats.map((s) => `${s.matches?.teams?.name}|${s.matches?.teams?.format}`)).size
  const earliestStat = allStats.map((s) => s.matches?.match_date ?? '').filter(Boolean).sort()[0]
  const earliestCompetition = allSeries.map((row) => row.series_date ?? '').filter(Boolean).sort()[0]
  const advanced = stats.filter((s) => has(s.percentage_supersonic_speed) || has(s.zero_boost_pct)).length
  const basic = stats.filter((s) => has(s.bpm) || has(s.avg_speed) || has(s.demos_inflicted) || has(s.boost_collected)).length
  const held = new Map<string, { name: string; records: string[] }>()
  const credit = (name: string, label: string) => {
    const key = name.toLowerCase(), entry = held.get(key) ?? { name, records: [] }
    if (!entry.records.includes(label)) entry.records.push(label)
    held.set(key, entry)
  }
  careerRecords.forEach((record) => record.holders.filter((h) => h.rank === 1).forEach((h) => credit(h.name, record.label)))
  gameRecords.forEach((record) => record.holders.forEach((h) => credit(h.name, record.label)))
  seriesRecords.forEach((record) => record.holders.forEach((h) => credit(h.name, record.label)))
  process.forEach((record) => record.gold.forEach((h) => credit(h.name, `${record.format} ${record.skill.label}`)))
  const recordHolders = [...held.values()].sort((a,b) => b.records.length - a.records.length || a.name.localeCompare(b.name))
  const recordKings = recordHolders.filter((entry) => entry.records.length === recordHolders[0]?.records.length)
  const latestRecord = timeline[0]
  const latestActivity = latestRecord ? timeline.filter((entry) => entry.date?.slice(0, 10) === latestRecord.date?.slice(0, 10)) : []

  const grid = (records: BookRecord[]) => <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{records.map((r) => <RecordCard key={r.label} record={r} />)}</div>
  return <main className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-16">
    <header className="rounded-3xl border border-purple-900/40 bg-[radial-gradient(circle_at_top_right,rgba(175,105,238,.2),transparent_38%),linear-gradient(135deg,#18131d,#0d0d0d_62%)] p-6 md:p-10">
      <div className="text-xs font-black uppercase tracking-[.28em] text-purple-400">Flop Reset</div><h1 className="mt-3 text-4xl font-black text-white md:text-7xl">RECORD BOOK</h1><p className="mt-3 text-neutral-400 md:text-lg">Competitive history since {earliestCompetition ? fmtDate(earliestCompetition) : 'the archive began'}; player-stat coverage is tracked separately.</p>
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{[['Competitive Games',uniqueGames],['Competitive Series',allSeries.length],['Players Recorded',uniquePlayers],['Recorded Squads',uniqueTeams],['History Since',earliestCompetition ? fmtDate(earliestCompetition) : '—'],['Player Stats Since',earliestStat ? fmtDate(earliestStat) : '—']].map(([label,value]) => <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-xs uppercase text-neutral-500">{label}</div><div className="mt-1 text-xl font-black text-white">{value}</div></div>)}</div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-amber-900/40 bg-black/20 p-4"><div className="text-xs uppercase text-amber-400">Current Record {recordKings.length === 1 ? 'King' : 'Leaders'}</div><div className="mt-1 text-xl font-black text-white">{recordKings.length ? recordKings.map((entry) => entry.name).join(' · ') : '—'}</div><div className="text-sm text-neutral-500">{recordKings.length ? `${recordKings[0].records.length} current records each` : 'No records yet'}</div></div>
        <div className="rounded-xl border border-purple-900/40 bg-black/20 p-4"><div className="text-xs uppercase text-purple-400">Latest Record Activity</div><div className="mt-1 text-xl font-black text-white">{latestRecord ? fmtDate(latestRecord.date) : '—'}</div><div className="text-sm text-neutral-500">{latestRecord ? `${latestActivity.length} new mark${latestActivity.length === 1 ? '' : 's'} · same-day activity grouped` : 'No proven event yet'}</div></div>
        <div className="rounded-xl border border-neutral-700 bg-black/20 p-4"><div className="text-xs uppercase text-neutral-500">Historical Standard</div><div className="mt-1 font-bold text-white">Date-safe progression</div><div className="text-sm text-neutral-500">No assumed same-day ordering</div></div>
      </div>
    </header>
    <nav className="my-8 flex flex-wrap gap-2">{['All',...formats].map((f) => <Link key={f} href={f === 'All' ? '/records' : `/records?format=${encodeURIComponent(f)}`} className={`rounded-full px-4 py-2 text-sm font-bold ${selected === f ? 'bg-purple-700 text-white' : 'border border-neutral-800 bg-[#151515] text-neutral-400'}`}>{f}</Link>)}</nav>
    <nav className="sticky top-0 z-20 -mx-4 mb-12 overflow-x-auto border-y border-neutral-800 bg-[#0b0b0b]/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
      <div className="flex min-w-max gap-5 text-xs font-bold uppercase tracking-wider text-neutral-500">{[['overview','Overview'],['career','Career'],['game','Game'],['series','Series'],['team','Team'],['process','Process'],['history','History']].map(([id,label]) => <a key={id} href={`#${id}`} className="hover:text-purple-300">{label}</a>)}</div>
    </nav>
    <section id="overview" className="mb-16 scroll-mt-20"><Heading overline="Latest milestones" title="Recent Record Activity" copy="Only meaningful new marks proven with date-level chronology. Same-day intra-event order is never inferred." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{timeline.slice(0,6).map((e) => <article key={`${e.category}-${e.id}`} className="rounded-2xl border border-purple-900/40 bg-[#111] p-5"><div className="text-xs font-black text-amber-400">NEW ORG RECORD</div><div className="mt-2 text-sm text-neutral-500">{e.category}</div><div className="mt-1 text-3xl font-black text-white">{fmt(e.value)} · {e.name}</div><div className="mt-3 text-sm text-neutral-400">{e.team} · {e.format}<br/>vs {e.opponent} · {fmtDate(e.date)}</div>{e.jointNames.length > 1 && <div className="mt-2 text-xs text-purple-300">Joint same-day record</div>}{e.previousValue !== undefined && <div className="mt-4 border-t border-neutral-800 pt-3 text-xs text-neutral-500">Previous record: {fmt(e.previousValue)}{e.previousNames?.length ? ` · ${e.previousNames.join(', ')}` : ''}<br/><span className="text-amber-400">+{fmt(e.value-e.previousValue)} over previous mark</span></div>}</article>)}</div></section>
    <section className="mb-16"><Heading overline="Current ownership" title="Record Holders" copy="Current positive-value records only. Joint holders each receive credit." /><div className="rounded-2xl border border-neutral-800 bg-[#111] p-5">{recordHolders.slice(0,10).map((entry,index) => <details key={entry.name} className="border-t border-neutral-800 py-3 first:border-0"><summary className="cursor-pointer list-none"><span className="mr-3 font-mono text-neutral-600">{index+1}</span><Link href={`/players/${encodeURIComponent(entry.name)}`} className="font-bold text-white hover:underline">{entry.name}</Link><span className="float-right text-purple-300">{entry.records.length} records</span></summary><ul className="mt-3 ml-8 space-y-1 text-sm text-neutral-500">{entry.records.map((record) => <li key={record}>• {record}</li>)}</ul></details>)}</div></section>
    <section id="career" className="mb-16 scroll-mt-20"><Heading overline="All-time totals & rates" title="Career Leaders" copy={`Competition-ranked top three. Rate eligibility is ${threshold} GP; forfeits are excluded.`} />{grid(careerRecords)}</section>
    <section id="game" className="mb-16 scroll-mt-20"><Heading overline="Peak · single game" title="Single-Game Records" copy="Every legitimate tie is retained; repeated tied performances expand on demand." />{grid(gameRecords)}</section>
    <section id="series" className="mb-16 scroll-mt-20"><Heading overline="Series · one matchup" title="Single-Series Records" copy="Series cards show only the series result and aggregate context—never a random individual game score." />{grid(seriesRecords)}</section>
    <section id="team" className="mb-16 scroll-mt-20"><Heading overline="Team · org performance" title="Team Records" copy="Reliable score-based records only. Streak claims remain withheld without authoritative ordering." />{grid(teamRecords)}</section>
    <section id="process" className="mb-16 scroll-mt-20"><Heading overline="Process · Ballchasing analytics" title="Process Records" copy="Ranked independently by format. NULL advanced fields never become zero." />
      <div className="mb-6 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><div className="text-xs font-bold uppercase text-neutral-500">Basic Tracking</div><div className="mt-2 text-3xl font-black text-white">{basic} / {stats.length}</div><div className="text-purple-300">{percent(avg(basic*100,stats.length))}</div><p className="mt-3 text-sm text-neutral-500">BPM · Avg Speed · Demos · Boost</p></div><div className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><div className="text-xs font-bold uppercase text-neutral-500">Advanced Tracking</div><div className="mt-2 text-3xl font-black text-white">{advanced} / {stats.length}</div><div className="text-purple-300">{percent(avg(advanced*100,stats.length))}</div><p className="mt-3 text-sm text-neutral-500">Supersonic · Air Time · Positioning · Zero Boost</p><p className="mt-2 text-xs text-neutral-600">Historical advanced tracking backfill in progress.</p></div></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{process.map((r) => <article key={`${r.format}-${r.skill.key}`} className="rounded-2xl border border-neutral-800 bg-[#111] p-5"><div className="flex justify-between gap-3"><div><div className="text-xs font-bold uppercase text-neutral-500">{r.format}</div><h3 className="mt-1 font-bold text-white">{r.skill.key === 'bpm' ? 'Career Avg BPM' : r.skill.key === 'avgSpeed' ? 'Career Avg Speed' : r.skill.label}</h3></div><div className="text-2xl font-black text-[#AF69EE]">{r.value}</div></div><div className="mt-5 space-y-2">{r.gold.length ? r.gold.map((h) => <div key={h.playerId}><Link href={`/players/${encodeURIComponent(h.name)}`} className="font-bold text-white hover:underline">{h.name}</Link><div className="text-xs text-neutral-500">{h.team} · {h.games} GP · eligible</div></div>) : <p className="text-sm text-neutral-600">No eligible tracked sample yet.</p>}</div><p className="mt-4 border-t border-neutral-800 pt-3 text-xs text-neutral-600">Minimum: {r.threshold} GP. {r.skill.key === 'zeroBoostPct' ? 'Lower is better.' : r.skill.key === 'positioningDepth' ? 'Descriptive only: higher means deeper.' : r.skill.description}</p></article>)}</div></section>
    <section id="history" className="scroll-mt-20"><Heading overline="History · date-safe progression" title="Record Evolution" copy="Major positive record changes grouped by calendar date. Ties on the same date are credited jointly." /><div className="ml-3 border-l border-purple-900/60 pl-6">{timeline.slice(0,30).map((e) => <article key={`t-${e.category}-${e.id}`} className="relative mb-4 rounded-xl border border-neutral-800 bg-[#111] p-4"><div className="absolute -left-[31px] top-5 h-3 w-3 rounded-full bg-purple-500"/><div className="text-xs text-neutral-600">{fmtDate(e.date)} · NEW RECORD</div><div className="mt-1 font-bold text-white">{e.category}: {fmt(e.value)}</div><div className="text-sm text-purple-300">{e.jointNames.map((name, index) => <span key={name}>{index > 0 ? ' · ' : ''}<Link href={`/players/${encodeURIComponent(name)}`} className="hover:underline">{name}</Link></span>)}</div><div className="mt-1 text-sm text-neutral-500">vs {e.opponent} · {e.team} · {e.format}</div>{e.previousValue !== undefined && <div className="mt-2 text-xs text-neutral-600">Previous: {fmt(e.previousValue)}{e.previousNames?.length ? ` · ${e.previousNames.join(', ')}` : ''} · +{fmt(e.value-e.previousValue)}</div>}</article>)}</div></section>
  </main>
}
