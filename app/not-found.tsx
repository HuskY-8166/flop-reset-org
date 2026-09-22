import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center md:px-8">
      <div className="text-xs font-black uppercase tracking-[.22em] text-purple-400">404 · Not Found</div>
      <h1 className="mt-3 text-4xl font-black text-white md:text-6xl">That archive page does not exist.</h1>
      <p className="mx-auto mt-4 max-w-xl text-neutral-400">The team, match, competition, or league identity may have moved or never been recorded.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-xl bg-purple-700 px-5 py-3 font-bold text-white no-underline hover:bg-purple-600">Return home</Link>
        <Link href="/search" className="rounded-xl border border-neutral-700 px-5 py-3 font-bold text-neutral-200 no-underline hover:border-purple-700">Search the archive</Link>
      </div>
    </main>
  )
}
