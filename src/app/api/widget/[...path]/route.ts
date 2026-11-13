import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-zentry-visitor, x-zentry-visitor-token',
  'x-orbat-widget-proxy': '1',
};

function getBackendServerBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000/api/v1')
    .trim()
    .replace(/\/+$/, '');
  if (!raw) return 'http://localhost:4000/api/v1';
  return raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function forwardRequest(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
  method: 'GET' | 'POST'
) {
  try {
    const { path } = await context.params;
    const subPath = (path || []).join('/');
    const search = req.nextUrl.search || '';
    const targetUrl = `${getBackendServerBaseUrl()}/widget/${subPath}${search}`;

    const headers: Record<string, string> = {};
    const contentType = req.headers.get('content-type');
    if (contentType) headers['Content-Type'] = contentType;
    const forwardedFor = req.headers.get('x-forwarded-for');
    if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;

    const body = method === 'POST' ? await req.text() : undefined;

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: method === 'POST' ? body || '{}' : undefined,
      cache: 'no-store',
    });

    const text = await upstream.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { message: text };
    }

    return NextResponse.json(json, {
      status: upstream.status,
      headers: CORS_HEADERS,
    });
  } catch (err: any) {
    console.error('[Widget Proxy Error]:', err);
    return NextResponse.json(
      { error: 'backend_unreachable', message: err?.message || 'Widget backend unreachable' },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forwardRequest(req, context, 'GET');
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forwardRequest(req, context, 'POST');
}

