'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage(error.message)
      setSubmitting(false)
    } else {
      router.push('/admin')
      router.refresh()
    }
  }

  return (
    <main className="mx-auto flex min-h-[75vh] max-w-md items-center px-4 py-12">
      <section className="w-full rounded-3xl border border-purple-900/40 bg-[radial-gradient(circle_at_top_right,rgba(175,105,238,.18),transparent_42%),#111] p-6 shadow-2xl shadow-black/30 md:p-8">
        <div className="text-xs font-black uppercase tracking-[.24em] text-purple-400">Private workspace</div>
        <h1 className="mt-2 text-4xl font-black text-white">Admin Login</h1>
        <p className="mt-2 text-sm text-neutral-500">Authorized Flop Reset record keepers only.</p>
        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <label className="block text-sm font-semibold text-neutral-300">Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-2 w-full rounded-xl border border-neutral-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20" /></label>
          <label className="block text-sm font-semibold text-neutral-300">Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-2 w-full rounded-xl border border-neutral-700 bg-black/40 px-4 py-3 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20" /></label>
          <button type="submit" disabled={submitting} className="w-full rounded-xl bg-purple-700 px-4 py-3 font-black text-white transition hover:bg-purple-600 disabled:cursor-wait disabled:opacity-60">{submitting ? 'Signing in…' : 'Log In'}</button>
        </form>
        <p aria-live="polite" className="mt-4 min-h-5 text-sm text-red-300">{message}</p>
      </section>
    </main>
  )
}
