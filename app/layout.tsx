import type { Metadata } from 'next'
import { Geist, Geist_Mono, Rajdhani, Teko } from 'next/font/google'
import { SiteNav } from '@/components/SiteNav'
import { BUILD_NUMBER } from '@/lib/build'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const rajdhani = Rajdhani({ variable: '--font-display', subsets: ['latin'], weight: ['500', '600', '700'] })
const teko = Teko({ variable: '--font-teko', subsets: ['latin'], weight: ['500', '600', '700'] })

export const metadata: Metadata = {
  title: { default: 'Flop Reset', template: '%s | Flop Reset' },
  description: 'Flop Reset competitive Rocket League results, player statistics, records, and permanent history.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${geistSans.variable} ${geistMono.variable} ${rajdhani.variable} ${teko.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteNav />
        {children}
        <footer className="mt-auto px-4 py-5 text-center text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-700">
          Flop Reset · Build {BUILD_NUMBER}
        </footer>
      </body>
    </html>
  )
}
