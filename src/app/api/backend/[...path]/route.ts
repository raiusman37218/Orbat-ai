import { NextRequest, NextResponse } from 'next/server';
import { resolveServerBackendBaseUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

const FORWARDED_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'x-workspace-id',
  'x-forwarded-for',
  'x-zentry-visitor',
  'x-zentry-visitor-token',
] as const;

async function proxyToBackend(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const backendBase = resolveServerBackendBaseUrl();
  if (!backendBase) {
    return NextResponse.json(
      {
        success: false,
        statusCode: 503,
        error: 'backend_not_configured',
        message:
          'Backend URL is not configured on the frontend deployment. Set NEXT_PUBLIC_BACKEND_URL or BACKEND_URL in your Vercel Frontend project environment variables.',
      },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const rawSubPath = (path || []).join('/').replace(/^\/+/, '');
  const subPath = rawSubPath.replace(/^api\/v1(?:\/|$)/i, '');
  const reqUrl = req.nextUrl ?? new URL(req.url);
  const targetUrl = `${backendBase}${subPath ? `/${subPath}` : ''}${reqUrl.search || ''}`;

  try {
    const parsedTarget = new URL(targetUrl);
    const requestHost = (req.headers.get('host') || reqUrl.host || '').toLowerCase();
    if (requestHost && parsedTarget.host.toLowerCase() === requestHost && parsedTarget.pathname.startsWith('/api/backend')) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 502,
          error: 'backend_loop_detected',
          message: 'BACKEND_URL cannot point back to /api/backend on the frontend origin.',
        },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json(
      {
        success: false,
        statusCode: 502,
        error: 'invalid_backend_url',
        message: 'Configured backend URL is invalid.',
      },
      { status: 502 },
    );
  }

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await req.arrayBuffer() : undefined;

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody && body && body.byteLength > 0 ? body : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    });

    const responseHeaders = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType) responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('x-orbat-backend-proxy', '1');

    const responseBody = method === 'HEAD' ? null : await upstream.arrayBuffer();
    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        statusCode: 502,
        error: 'backend_unreachable',
        message: err?.message || 'Unable to reach backend service.',
      },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToBackend(req, context);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToBackend(req, context);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToBackend(req, context);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToBackend(req, context);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToBackend(req, context);
}

export async function HEAD(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToBackend(req, context);
}
