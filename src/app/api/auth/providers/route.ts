import { NextResponse } from 'next/server';

export async function GET() {
  const google = Boolean(
    (process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim(),
  );
  return NextResponse.json({ google, email: true });
}

