import { NextResponse } from 'next/server'

export async function GET() {
  const checks = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    S3_REGION: !!process.env.S3_REGION,
    S3_ACCESS_KEY_ID: !!process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: !!process.env.S3_SECRET_ACCESS_KEY,
    S3_BUCKET_NAME: !!process.env.S3_BUCKET_NAME,
    NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
  }

  const allOk = Object.values(checks).every(v => v === true || typeof v === 'string')

  return NextResponse.json({ status: allOk ? 'ok' : 'missing_vars', checks })
}
