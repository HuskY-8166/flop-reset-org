import Link from 'next/link'
import type { ReactNode } from 'react'

export function PageHero({ eyebrow, title, description, children, accent = '#AF69EE' }: {
  eyebrow: string; title: ReactNode; description: string; children?: ReactNode; accent?: string
}) {
  return <header className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-[#101010] p-6 md:p-10">
    <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: `radial-gradient(circle at 85% 10%, ${accent}33, transparent 38%)` }} />
    <div className="relative"><div className="text-xs font-black uppercase tracking-[.26em]" style={{ color: accent }}>{eyebrow}</div>
      <h1 className="mt-3 text-4xl font-black leading-none tracking-tight text-white md:text-7xl">{title}</h1>
      <p className="mt-4 max-w-3xl text-base text-neutral-400 md:text-lg">{description}</p>{children && <div className="mt-8">{children}</div>}</div>
  </header>
}

export function SectionHeader({ eyebrow, title, description, href, linkLabel = 'View all' }: {
  eyebrow?: string; title: string; description?: string; href?: string; linkLabel?: string
}) {
  return <div className="mb-5 flex items-end justify-between gap-4"><div>{eyebrow && <div className="text-xs font-bold uppercase tracking-[.2em] text-purple-400">{eyebrow}</div>}<h2 className="mt-1 text-3xl font-black text-white">{title}</h2>{description && <p className="mt-1 max-w-2xl text-sm text-neutral-500">{description}</p>}</div>{href && <Link href={href} className="min-w-max text-sm font-semibold text-purple-300 hover:underline">{linkLabel} →</Link>}</div>
}

export function StatCard({ label, value, detail, accent = false }: { label: string; value: ReactNode; detail?: string; accent?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${accent ? 'border-purple-800 bg-purple-950/20' : 'border-neutral-800 bg-[#111]'}`}><div className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-1 text-3xl font-black text-white">{value}</div>{detail && <div className="mt-1 text-xs text-neutral-600">{detail}</div>}</div>
}

export function EmptyState({ title, description, actionHref, actionLabel }: { title: string; description: string; actionHref?: string; actionLabel?: string }) {
  return <div className="rounded-2xl border border-dashed border-neutral-700 bg-[#101010]/70 p-7 text-center"><h3 className="text-xl font-bold text-white">{title}</h3><p className="mx-auto mt-2 max-w-lg text-sm text-neutral-500">{description}</p>{actionHref && actionLabel && <Link href={actionHref} className="mt-4 inline-block rounded-lg border border-purple-800 px-4 py-2 text-sm font-semibold text-purple-300 no-underline hover:bg-purple-950">{actionLabel}</Link>}</div>
}

export function ResultBadge({ wins, losses }: { wins: number; losses: number }) {
  const won = wins > losses, tied = wins === losses
  return <span className={`rounded-full px-3 py-1 text-sm font-black ${tied ? 'bg-neutral-800 text-neutral-300' : won ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>{tied ? 'T' : won ? 'W' : 'L'} {wins}–{losses}</span>
}

export function FormIndicator({ results }: { results: { id: string | number; won: boolean; href?: string }[] }) {
  return <div className="flex flex-wrap gap-2" aria-label="Recent form">{results.map((result) => {
    const chip = <span className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-black ${result.won ? 'border-emerald-900 bg-emerald-950 text-emerald-400' : 'border-red-900 bg-red-950 text-red-400'}`}>{result.won ? 'W' : 'L'}</span>
    return result.href ? <Link key={result.id} href={result.href} aria-label={`Open ${result.won ? 'win' : 'loss'}`}>{chip}</Link> : <span key={result.id}>{chip}</span>
  })}</div>
}

export function EntityBadge({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-neutral-700 bg-black/20 px-3 py-1 text-xs font-semibold text-neutral-300">{children}</span>
}
