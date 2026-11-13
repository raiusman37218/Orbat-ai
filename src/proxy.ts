import { NextResponse, type NextRequest } from 'next/server';

function base64UrlToUint8Array(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function decodeNestJwt(token: string): Promise<Record<string, any> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Fail closed: never trust unsigned or unverified tokens when JWT_SECRET is missing.
    const secret = process.env.JWT_SECRET;
    if (!secret || !globalThis.crypto?.subtle) {
      return null;
    }

    const headerJson = new TextDecoder().decode(base64UrlToUint8Array(parts[0]));
    const header = JSON.parse(headerJson);
    if (!header || typeof header !== 'object' || header.alg !== 'HS256') {
      return null;
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = base64UrlToUint8Array(parts[2]);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes.buffer.slice(sigBytes.byteOffset, sigBytes.byteOffset + sigBytes.byteLength) as ArrayBuffer,
      encoder.encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) return null;

    const json = new TextDecoder().decode(base64UrlToUint8Array(parts[1]));
    const payload = JSON.parse(json);
    if (!payload || typeof payload !== 'object') return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-next-pathname', request.nextUrl.pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const pathname = request.nextUrl.pathname;

  // 1. Native NestJS / Orbat JWT authentication check
  const nestToken = request.cookies.get('orbat_access_token')?.value;
  let userId: string | null = null;
  let isSuperAdmin = false;

  if (nestToken) {
    try {
      const payload = await decodeNestJwt(nestToken);
      if (payload) {
        userId = payload.sub || payload.id || null;
        isSuperAdmin = Boolean(payload.isSuperAdmin);
      }
    } catch {
      userId = null;
    }
  }

  // 2. Protect /dashboard: Requires valid session
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    if (!userId) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Protect /admin: Requires logged in user / super-admin
  if ((pathname === '/admin' || pathname.startsWith('/admin/')) && !pathname.startsWith('/admin/invite')) {
    if (!userId) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
    if (pathname.startsWith('/admin/access') && !isSuperAdmin) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // 4. Redirect already-logged-in users away from /login and /signup
  if ((pathname === '/login' || pathname === '/signup') && userId) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 5. Rewrite custom Help Center domains and <slug>.HELP_BASE_DOMAIN subdomains to /help/<workspace>
  try {
    const { resolveHelpCenterRewriteUrl } = await import('@/lib/help/custom-domain-routing');
    const rewriteUrl = await resolveHelpCenterRewriteUrl(request);
    if (rewriteUrl) {
      return NextResponse.rewrite(rewriteUrl);
    }
  } catch {
    // Non-fatal: fall through to standard routing if custom domain resolution fails
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (widget.js, demo.html, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|widget.js|demo.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
