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
  { href: "/stats", label: "Stats" },
  { href: "/power-rankings", label: "Power" },
  { href: "/records", label: "Records" },
  { href: "/matches", label: "Results" },
  { href: "/schedule", label: "Schedule" },
  { href: "/rivalries", label: "History" },
];

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
          <div className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto px-4 py-3 md:px-8">
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
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
