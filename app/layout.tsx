'use client'

import { Geist, Geist_Mono, Rajdhani, Teko } from "next/font/google";
import { usePathname } from "next/navigation";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const rajdhani = Rajdhani({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const teko = Teko({
  variable: "--font-teko",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const links = [
  { href: "/", label: "Home" },
  { href: "/teams", label: "Teams" },
  { href: "/matches", label: "Matches" },
  { href: "/stats", label: "Stats" },
  { href: "/competitions", label: "League" },
  { href: "/history", label: "History" },
];

const moreLinks = [
  { href: '/search', label: 'Search' },
  { href: '/power-rankings', label: 'Power Rankings' },
  { href: '/records', label: 'Record Book' },
  { href: '/rivalries', label: 'Rivalries' },
  { href: '/history/leaders', label: 'All-Time Leaders' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/about', label: 'About' },
]

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${rajdhani.variable} ${teko.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="sticky top-0 z-50 border-b border-neutral-800 bg-[#0d0d0d]/95 backdrop-blur" aria-label="Primary navigation">
          <div className="mx-auto flex w-full min-w-0 max-w-7xl items-center gap-3 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:px-8">
            <Link href="/" className="mr-2 min-w-max text-sm font-black tracking-wider text-white no-underline">
              FLOP <span className="text-purple-400">RESET</span>
            </Link>
            {links.map((link) => {
              const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
              return <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined}
                className={`min-w-max rounded-md px-2 py-1 text-sm font-semibold no-underline transition-colors ${active ? 'bg-purple-950 text-purple-200' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}`}>
                {link.label}
              </Link>
            })}
            <details className="group relative min-w-max">
              <summary className={`cursor-pointer list-none rounded-md px-2 py-1 text-sm font-semibold ${moreLinks.some((link) => pathname.startsWith(link.href)) ? 'bg-purple-950 text-purple-200' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}`}>More ▾</summary>
              <div className="fixed left-4 right-4 top-14 z-50 grid gap-1 rounded-xl border border-neutral-800 bg-[#111] p-2 shadow-2xl md:absolute md:left-auto md:right-0 md:top-9 md:w-52">
                {moreLinks.map((link) => <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm text-neutral-300 no-underline hover:bg-purple-950 hover:text-white">{link.label}</Link>)}
              </div>
            </details>
            <form action="/search" className="ml-auto hidden min-w-[190px] items-center rounded-lg border border-neutral-800 bg-black/30 focus-within:border-purple-700 md:flex">
              <label htmlFor="site-search" className="sr-only">Search Flop Reset</label>
              <input id="site-search" name="q" type="search" placeholder="Search players, teams…" className="w-40 bg-transparent px-3 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none" />
              <button type="submit" className="px-3 py-1.5 text-neutral-500 hover:text-purple-300" aria-label="Search">⌕</button>
            </form>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
