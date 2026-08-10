'use client'

import { Geist, Geist_Mono, Rajdhani, Teko } from "next/font/google";
import { usePathname } from "next/navigation";
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
  { href: "/schedule", label: "Schedule" },
  { href: "/teams", label: "Teams" },
  { href: "/standings", label: "Standings" },
  { href: "/power-rankings", label: "Power Rankings" },
  { href: "/stats", label: "Stats" },
  { href: "/records", label: "Records" },
  { href: "/rivalries", label: "Rivalries" },
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
        <nav style={{ padding: '1rem 2rem', borderBottom: '1px solid #262626', display: 'flex', gap: '1.5rem', backgroundColor: '#111' }}>
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={pathname === link.href ? 'text-white font-semibold border-b-2 pb-1' : 'text-blue-400 hover:text-white'}
              style={pathname === link.href ? { borderColor: '#AF69EE' } : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
        {children}
      </body>
    </html>
  );
}