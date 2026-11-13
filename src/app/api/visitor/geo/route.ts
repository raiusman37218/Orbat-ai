import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { serviceClient } from '@/lib/pg/service';
import { clientIpOf, geoFromRequest } from '@/lib/geo';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyVisitorToken } from '@/lib/widget/visitor-token';

function useNeon(): boolean {
  return !process.env.VITEST || Boolean(process.env.TEST_DATABASE_URL);
}

// Called by the embeddable widget from the customer's own site.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Stores the visitor's city and country, worked out from the request's own IP
 * on the server. The browser cannot supply (or fake) the location: only the
 * visitor id and its session token come from the body, and the token must be
 * that visitor's, so nobody can pin their own IP on someone else.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIpOf(req.headers) || 'unknown';
    if (!(await checkRateLimit(`geo:${ip}`, 60, 60))) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: CORS_HEADERS });
    }

    const body = await req.json().catch(() => ({}));
    const session = await verifyVisitorToken(body.visitor_id || body.visitorId, body.visitor_token);
    if (!session) {
      return NextResponse.json({ error: 'session_invalid' }, { status: 401, headers: CORS_HEADERS });
    }
    const visitorId = session.visitorId;

    const geo = await geoFromRequest(req.headers);
    if (!geo.country) {
      return NextResponse.json({ success: false, reason: 'Location unknown' }, { headers: CORS_HEADERS });
    }

    const location = geo.city ? `${geo.city}, ${geo.country}` : geo.country;
    if (useNeon()) {
      try {
        await query(
          `UPDATE public.visitors
           SET location = $1,
               ip_location_city = $2,
               ip_location_country = $3,
               ip_address = $4
           WHERE id = $5`,
          [location, geo.city, geo.country, clientIpOf(req.headers), visitorId]
        );
      } catch {
        await query(
          `UPDATE public.visitors
           SET ip_location_city = $1,
               ip_location_country = $2
           WHERE id = $3`,
          [geo.city, geo.country, visitorId]
        );
      }
      return NextResponse.json(
        { success: true, city: geo.city, country: geo.country, countryCode: geo.countryCode, location },
        { headers: CORS_HEADERS }
      );
    }

    const supabase = serviceClient();
    const { error } = await supabase
      .from('visitors')
      .update({
        location,
        ip_location_city: geo.city,
        ip_location_country: geo.country,
        ip_address: clientIpOf(req.headers),
      })
      .eq('id', visitorId);

    if (error) {
      // Older databases may lack one of these columns; the two that every
      // schema has are what the dashboard reads first.
      await supabase
        .from('visitors')
        .update({ ip_location_city: geo.city, ip_location_country: geo.country })
        .eq('id', visitorId);
    }

    return NextResponse.json(
      { success: true, city: geo.city, country: geo.country, countryCode: geo.countryCode, location },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Geo lookup failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
