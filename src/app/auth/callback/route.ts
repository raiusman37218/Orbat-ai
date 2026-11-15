import { NextResponse } from 'next/server';
import { resolveServerBackendBaseUrl } from '@/lib/backend-url';
import { exchangeGoogleOAuthAndSignIn } from '@/lib/auth/backend-auth-fallback';
import { authPathForMode, parseOAuthState } from '@/lib/data/auth-rules';

export function sanitizeNextPath(raw: string | null | undefined, fallback = '/app'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return fallback;
  }
  if (raw.includes('://') || raw.includes('@')) {
    return fallback;
  }
  return raw;
}

function getCallbackContext(requestUrl: string): {
  errorAuthPath: '/login' | '/signup';
  stateNext: string;
} {
  try {
    const { searchParams } = new URL(requestUrl);
    const parsedState = parseOAuthState(searchParams.get('state'));
    const explicitNext = searchParams.get('next');
    return {
      errorAuthPath: authPathForMode(parsedState.mode),
      stateNext: explicitNext ? sanitizeNextPath(explicitNext) : parsedState.next,
    };
  } catch {
    return { errorAuthPath: '/login', stateNext: '/app' };
  }
}

/**
 * Resolves the base URL for redirects.
 * Uses `x-forwarded-host` only if it is listed in `NEXT_PUBLIC_PLATFORM_HOSTS`
 * (comma-separated); otherwise uses the request origin.
 */
export function resolveBaseUrl(request: Request, origin: string): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const allowedHosts = (process.env.NEXT_PUBLIC_PLATFORM_HOSTS || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    const host = forwardedHost.trim().toLowerCase();
    if (allowedHosts.includes(host)) {
      return `https://${forwardedHost.trim()}`;
    }
  }
  return origin;
}

function buildAuthenticatedRedirect(
  baseUrl: string,
  stateNext: string,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    user?: unknown;
    workspace?: { id?: string } | null;
  },
) {
  const effectiveNext = sanitizeNextPath(stateNext, '/app');
  const targetPath =
    tokens.workspace?.id || effectiveNext !== '/app' ? effectiveNext : '/onboarding';
  const res = NextResponse.redirect(`${baseUrl}${targetPath}`);
  const cookieOpts = {
    path: '/',
    maxAge: 604800,
    sameSite: 'lax' as const,
    secure: baseUrl.startsWith('https://'),
  };
  res.cookies.set('orbat_access_token', tokens.accessToken, cookieOpts);
  if (tokens.refreshToken) {
    res.cookies.set('orbat_refresh_token', tokens.refreshToken, {
      ...cookieOpts,
      maxAge: 2592000,
    });
  }
  if (tokens.user) {
    res.cookies.set('orbat_user', JSON.stringify(tokens.user), cookieOpts);
  }
  if (tokens.workspace) {
    res.cookies.set('orbat_workspace', JSON.stringify(tokens.workspace), cookieOpts);
  }
  return res;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const { errorAuthPath, stateNext } = getCallbackContext(request.url);
  const baseUrl = resolveBaseUrl(request, origin);

  if (error) {
    const errorMsg = errorDescription || error;
    return NextResponse.redirect(`${baseUrl}${errorAuthPath}?error=${encodeURIComponent(errorMsg)}`);
  }

  if (code) {
    const backendUrl = resolveServerBackendBaseUrl();
    let backendErrorMessage: string | null = null;
    let shouldTryDirectFallback = !backendUrl;

    if (backendUrl) {
      try {
        const backendRes = await fetch(`${backendUrl}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            redirectUri: `${baseUrl}/auth/callback`,
          }),
        });

        if (backendRes.ok) {
          const authData = await backendRes.json();
          const tokens = authData.data || authData;
          if (!tokens?.accessToken) {
            return NextResponse.redirect(
              `${baseUrl}${errorAuthPath}?error=${encodeURIComponent('Authentication failed: missing access token.')}`,
            );
          }
          return buildAuthenticatedRedirect(baseUrl, stateNext, tokens);
        }

        if (backendRes.status >= 500) {
          shouldTryDirectFallback = true;
        } else {
          const errBody = await backendRes.json().catch(() => null);
          backendErrorMessage = errBody?.message || errBody?.error || null;
        }
      } catch (e: unknown) {
        shouldTryDirectFallback = true;
        backendErrorMessage = e instanceof Error ? e.message : String(e);
      }
    }

    if (shouldTryDirectFallback) {
      try {
        const directTokens = await exchangeGoogleOAuthAndSignIn(
          {
            code,
            redirectUri: `${baseUrl}/auth/callback`,
          },
          baseUrl,
        );
        return buildAuthenticatedRedirect(baseUrl, stateNext, directTokens);
      } catch (fallbackErr: unknown) {
        backendErrorMessage =
          fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      }
    }

    const errorToDisplay = backendErrorMessage || 'Authentication failed.';
    return NextResponse.redirect(
      `${baseUrl}${errorAuthPath}?error=${encodeURIComponent(
        Array.isArray(errorToDisplay) ? errorToDisplay.join(', ') : errorToDisplay,
      )}`,
    );
  }

  return NextResponse.redirect(`${baseUrl}${errorAuthPath}?error=no_auth_code`);
}
