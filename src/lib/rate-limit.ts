import { queryRows } from '@/lib/db';
import { serviceClient } from '@/lib/supabase/service';

function useNeon(): boolean {
  return !process.env.VITEST || Boolean(process.env.TEST_DATABASE_URL);
}

/**
 * Checks whether an action in `bucket` is within its limit of `max` hits per
 * `windowSeconds`. Calls `fn_rate_limit` in Neon Postgres at runtime or via
 * the mocked Supabase service client in Vitest tests.
 *
 * If the query/RPC fails or throws, the request is allowed so that
 * infrastructure issues never block customers.
 *
 * Returns true if allowed, false if rate limited.
 */
export async function checkRateLimit(
  bucket: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    if (useNeon()) {
      const rows = await queryRows<{ allowed?: boolean }>(
        'SELECT public.fn_rate_limit($1::text, $2::int, $3::int) AS allowed',
        [bucket, max, windowSeconds]
      );
      return rows[0]?.allowed !== false;
    }

    const supabase = serviceClient();
    if (typeof supabase?.rpc !== 'function') {
      return true;
    }
    const { data, error } = await supabase.rpc('fn_rate_limit', {
      p_bucket: bucket,
      p_max: max,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.warn('[RateLimit] RPC error, allowing request:', error.message);
      return true;
    }

    return data !== false;
  } catch (err: unknown) {
    console.warn('[RateLimit] Unexpected error, allowing request:', err);
    return true;
  }
}
