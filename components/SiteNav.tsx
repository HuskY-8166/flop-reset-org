'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const primaryLinks = [
  { href: '/', label: 'Home', mobile: true },
  { href: '/teams', label: 'Teams', mobile: true },
  { href: '/matches', label: 'Matches', mobile: true },
  { href: '/stats', label: 'Stats', mobile: true },
  { href: '/competitions', label: 'Competitions', mobile: false },
  { href: '/history', label: 'History', mobile: false },
]

const moreLinks = [
  { href: '/search', label: 'Search' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/standings', label: 'Standings' },
  { href: '/power-rankings', label: 'Power Rankings' },
  { href: '/records', label: 'Record Book' },
  { href: '/rivalries', label: 'Rivalries' },
  { href: '/history/leaders', label: 'All-Time Leaders' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/about', label: 'About' },
]

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function closeFromOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }

    document.addEventListener('mousedown', closeFromOutside)
    document.addEventListener('keydown', closeFromKeyboard)
    return () => {
      document.removeEventListener('mousedown', closeFromOutside)
      document.removeEventListener('keydown', closeFromKeyboard)
    }
  }, [open])

  const moreActive = moreLinks.some((link) => isActive(pathname, link.href))

  return (
    <nav ref={containerRef} className="sticky top-0 z-[100] border-b border-neutral-800 bg-[#0d0d0d]/95 backdrop-blur" aria-label="Primary navigation">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-3 md:gap-3 md:px-8">
        <Link href="/" className="mr-1 min-w-max text-sm font-black tracking-wider text-white no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-400">
          FLOP <span className="text-purple-400">RESET</span>
        </Link>

        <div className="flex min-w-0 items-center gap-1 md:gap-2">
          {primaryLinks.map((link) => {
            const active = isActive(pathname, link.href)
            return (
              <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined} className={`${link.mobile ? '' : 'hidden lg:inline-flex'} min-w-max rounded-md px-2 py-1 text-sm font-semibold no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 ${active ? 'bg-purple-950 text-purple-200' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}`}>
                {link.label}
              </Link>
            )
          })}
        </div>

        <button ref={buttonRef} type="button" aria-expanded={open} aria-haspopup="menu" aria-controls="site-more-menu" onClick={() => setOpen((current) => !current)} className={`ml-auto min-w-max rounded-md px-2 py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 ${moreActive || open ? 'bg-purple-950 text-purple-200' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}`}>
          More <span aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>

        <form action="/search" className="hidden min-w-[190px] items-center rounded-lg border border-neutral-800 bg-black/30 focus-within:border-purple-700 md:flex">
          <label htmlFor="site-search" className="sr-only">Search Flop Reset</label>
          <input id="site-search" name="q" type="search" placeholder="Search players, teams…" className="w-40 bg-transparent px-3 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none" />
          <button type="submit" className="px-3 py-1.5 text-neutral-500 hover:text-purple-300 focus-visible:outline-2 focus-visible:outline-purple-400" aria-label="Search">⌕</button>
        </form>
      </div>

      {open ? (
        <div id="site-more-menu" role="menu" className="fixed right-4 top-[3.65rem] z-[110] grid w-[min(20rem,calc(100vw-2rem))] grid-cols-2 gap-1 rounded-xl border border-neutral-700 bg-[#111] p-2 shadow-2xl shadow-black/70 md:right-8 md:w-64 md:grid-cols-1">
          {moreLinks.map((link) => (
            <Link key={link.href} href={link.href} role="menuitem" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-neutral-300 no-underline hover:bg-purple-950 hover:text-white focus-visible:bg-purple-950 focus-visible:text-white focus-visible:outline-2 focus-visible:outline-purple-400">
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  )
}
