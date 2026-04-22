import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  return NextResponse.json({
    cookieNames: allCookies.map(c => c.name),
    cookieCount: allCookies.length,
    user: user ? { id: user.id, email: user.email } : null,
    error: error?.message ?? null,
  })
}
