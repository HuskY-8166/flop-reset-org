/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, PageHero, SectionHeader } from '@/components/ui'
import { competitionIdentity } from '@/lib/competitions'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [{ data }, { data: override }] = await Promise.all([
    supabase.from('public_league_players').select('canonical_name').eq('slug', slug).maybeSingle(),
    supabase.from('public_page_content_overrides').select('seo_title, seo_description').eq('page_key', `league-player:${slug}`).maybeSingle(),
  ])
  return { title: override?.seo_title || (data ? `${data.canonical_name} — League Player` : 'League Player — Flop Reset'), description: override?.seo_description || undefined }
}

export default async function LeaguePlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [{ data: player }, { data: pageOverride }] = await Promise.all([
    supabase.from('public_league_players').select('*').eq('slug', slug).maybeSingle(),
    supabase.from('public_page_content_overrides').select('*').eq('page_key', `league-player:${slug}`).maybeSingle(),
  ])
  if (!player) return <main className="mx-auto max-w-5xl px-4 py-16"><EmptyState title="League player not found" description="A soft player page is created only when a stable league identity exists." actionHref="/search" actionLabel="Search" /></main>
  if (pageOverride?.is_visible === false) return <main className="mx-auto max-w-5xl px-4 py-16"><EmptyState title="League player page unavailable" description="This page is currently hidden by an administrator." actionHref="/search" actionLabel="Search" /></main>
  const { data: memberships } = await supabase.from('public_competition_roster_members').select('*').eq('league_player_id', player.league_player_id).order('created_at', { ascending: false })
  const rows = (memberships ?? []) as any[]
  return <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10 md:px-8 md:py-14">
    <PageHero eyebrow="League Player" title={pageOverride?.title_override || player.display_name || player.canonical_name} description={pageOverride?.subtitle_override || 'External league identity. Team-level results are not converted into fake individual performance metrics.'}>
      <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-neutral-700 px-3 py-1">{player.status}</span>{player.linked_fr_player_id ? <span className="rounded-full border border-purple-800 px-3 py-1 text-purple-300">Linked FR player</span> : <span className="rounded-full border border-neutral-800 px-3 py-1 text-neutral-500">League identity only</span>}</div>
    </PageHero>
    {player.aliases?.length ? <section className="mt-10"><SectionHeader eyebrow="Identity" title="Known Aliases" /><div className="flex flex-wrap gap-2">{player.aliases.map((alias: string) => <span key={alias} className="rounded-full border border-neutral-700 px-3 py-1 text-sm">{alias}</span>)}</div></section> : null}
    <section className="mt-10"><SectionHeader eyebrow="Historical snapshots" title="Competition Rosters" />{rows.length ? <div className="space-y-3">{rows.map((membership) => { const competition = { name: membership.competition_name, format: membership.competition_format, league_name: membership.competition_league_name, circuit_name: membership.competition_circuit_name, season_year: membership.competition_season_year, region: membership.competition_region }; const identity = competitionIdentity(competition); return <Link key={membership.roster_member_id} href={`/league/teams/${membership.entry_slug}`} className="block rounded-2xl border border-neutral-800 bg-[#111] p-5 text-white no-underline hover:border-purple-700"><div className="font-black">{membership.entry_display_name}</div><div className="mt-1 text-sm text-neutral-500">{identity.seasonLabel} · {membership.competition_format ?? 'Format TBD'} · {membership.role} · {membership.is_current ? 'current snapshot' : 'historical snapshot'}</div></Link> })}</div> : <EmptyState title="No competition roster linked" description="The identity exists, but an event roster has not been attached." />}</section>
  </main>
}
