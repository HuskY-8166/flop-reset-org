import { createClient } from '@supabase/supabase-js'

export function authenticatedSupabase(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined,
  )
  return { client, token }
}

export async function requireSiteAdmin(request: Request) {
  const { client, token } = authenticatedSupabase(request)
  if (!token) return { client, user: null, error: 'Authentication required.' }
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return { client, user: null, error: 'Authentication expired.' }
  const isAdmin = data.user.app_metadata?.site_admin === true
  return { client, user: data.user, error: isAdmin ? null : 'Site Admin permission required.' }
}
