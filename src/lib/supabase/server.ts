import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

const DUMMY_URL = 'https://noop.supabase.co';
const DUMMY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || DUMMY_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DUMMY_KEY;

/**
 * Creates a server-side Supabase client for Server Components, Server Actions,
 * and Route Handlers with Next.js cookie persistence.
 */
export async function createClient<T = any>() {
  const cookieStore = await cookies();

  return createServerClient<T>(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  );
}

export type { Database };
