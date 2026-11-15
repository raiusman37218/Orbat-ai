import { NextResponse } from 'next/server';
import { resolveGoogleOAuthCredentials } from '@/lib/auth/backend-auth-fallback';

export async function GET() {
  const creds = await resolveGoogleOAuthCredentials();
  const google = Boolean(creds.clientId);
  return NextResponse.json({ google, email: true });
}
