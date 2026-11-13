import 'server-only';
import crypto from 'node:crypto';
import { findPgAuthUserByEmail, type PgAuthUser } from '@/lib/auth/postgres-auth';

/**
 * Generates a cryptographically sound 6-digit OTP code using crypto.randomInt
 */
export function generate6DigitCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Compares two codes in constant time to prevent timing attacks.
 */
export function timingSafeCodeCheck(input: string, stored: string): boolean {
  const bufInput = Buffer.from(input, 'utf8');
  const bufStored = Buffer.from(stored, 'utf8');
  if (bufInput.length !== bufStored.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufInput, bufStored);
}

/**
 * Looks up a pure-PostgreSQL auth account or agent by email.
 * Accepts either (email) or legacy (unusedAdmin, email) during caller migration.
 */
export async function findAuthUserByEmail(
  emailOrAdmin: string | unknown,
  maybeEmail?: string,
): Promise<PgAuthUser | null> {
  const targetEmail = typeof emailOrAdmin === 'string' ? emailOrAdmin : maybeEmail || '';
  return findPgAuthUserByEmail(targetEmail);
}
