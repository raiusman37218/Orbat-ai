import { NextRequest, NextResponse } from 'next/server';
import {
  executeWidgetFallback,
  WidgetFallbackHttpError,
} from '@/lib/widget/proxy-fallback';
import { resolveServerBackendBaseUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-zentry-visitor, x-zentry-visitor-token',
  'x-orbat-widget-proxy': '1',
};

function getBackendServerBaseUrl(): string | null {
  return resolveServerBackendBaseUrl();
}

function parseJsonBody(raw: string | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function handleWithFallback(
  subPath: string,
  method: 'GET' | 'POST',
  searchParams: URLSearchParams,
  rawBody: string | undefined
) {
  try {
    const data = await executeWidgetFallback(
      subPath,
      method,
      searchParams,
      parseJsonBody(rawBody)
    );
    return NextResponse.json(
      { success: true, data },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (fallbackErr: any) {
    if (fallbackErr instanceof WidgetFallbackHttpError) {
      return NextResponse.json(
        {
          statusCode: fallbackErr.status,
          error: fallbackErr.status === 404 ? 'Not Found' : 'Widget Error',
          message: fallbackErr.message,
        },
        { status: fallbackErr.status, headers: CORS_HEADERS }
      );
    }
    console.error('[Widget Fallback Error]:', fallbackErr);
    return NextResponse.json(
      {
        error: 'backend_unreachable',
        message: fallbackErr?.message || 'Widget backend unreachable',
      },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}

async function forwardRequest(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
  method: 'GET' | 'POST'
) {
  const { path } = await context.params;
  const subPath = (path || []).join('/');
  const search = req.nextUrl.search || '';
  const body = method === 'POST' ? await req.text() : undefined;
  const backendBase = getBackendServerBaseUrl();

  if (!backendBase) {
    return handleWithFallback(subPath, method, req.nextUrl.searchParams, body);
  }

  const targetUrl = `${backendBase}/widget/${subPath}${search}`;

  const headers: Record<string, string> = {};
  for (const name of ['content-type', 'authorization', 'x-forwarded-for', 'x-zentry-visitor', 'x-zentry-visitor-token']) {
    const val = req.headers.get(name);
    if (val) headers[name === 'content-type' ? 'Content-Type' : name] = val;
  }

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: method === 'POST' ? body || '{}' : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    });

    const shouldTryFallback = upstream.status >= 500 || upstream.status === 404;

    if (!shouldTryFallback) {
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
    }
  } catch {
    // NestJS backend unreachable or timed out -> serve directly via PostgreSQL fallback
  }

  return handleWithFallback(subPath, method, req.nextUrl.searchParams, body);
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forwardRequest(req, context, 'GET');
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forwardRequest(req, context, 'POST');
}

