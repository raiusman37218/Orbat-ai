import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';

const DUMMY_URL = 'https://noop.supabase.co';
const DUMMY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || DUMMY_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DUMMY_KEY;

let clientInstance: any = null;

/**
 * Creates or reuses a browser-side Supabase client for React client components.
 * Fallback client used only when native backend is not used.
 */
export function createClient<T = any>() {
  if (typeof window === 'undefined') {
    return createBrowserClient<T>(SUPABASE_URL, SUPABASE_KEY);
  }
  if (!clientInstance) {
    clientInstance = createBrowserClient<T>(SUPABASE_URL, SUPABASE_KEY);
  }
  return clientInstance;
}

export type { Database };
