/**
 * Centralized secret resolution with production fail-fast.
 *
 * Development/test convenience defaults live here (one place, clearly labeled),
 * but in production a missing secret throws at startup instead of silently
 * falling back to a committed, well-known value — which would otherwise allow,
 * e.g., anyone to forge JWTs. Real production values come from the environment /
 * a secret manager (AWS Secrets Manager, GitHub Actions secrets, …).
 */

/** Dev/test-only JWT secret. MUST be overridden via JWT_SECRET in production. */
export const DEV_JWT_SECRET =
  'your-super-secret-jwt-key-change-in-production-2026';

/** Dev/test-only DB password (matches docker-compose defaults). */
export const DEV_DB_PASSWORD = 'S3cur3P@ssw0rd!2026';

/**
 * Returns `value` if set. Otherwise: in production, throws (fail fast); in any
 * other environment, returns the development fallback.
 */
export function requireSecret(
  value: string | undefined,
  name: string,
  devFallback: string,
): string {
  if (value) {
    return value;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `Required secret "${name}" is not set. Provide it via the environment or a ` +
        `secret manager — the built-in fallback is for development only and must ` +
        `never be used in production.`,
    );
  }
  return devFallback;
}
