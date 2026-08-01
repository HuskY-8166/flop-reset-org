'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage(error.message)
    } else {
      router.push('/admin')
    }
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '400px' }}>
      <h1>Login</h1>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">Log In</button>
      </form>
      {message && <p>{message}</p>}
    </main>
  )
}