import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';
export const SKIP_RATE_LIMIT_KEY = 'skip_rate_limit';

/**
 * Per-route rate-limit options.
 */
export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * Overrides the global rate limit for a specific route.
 *
 * @example
 * ```typescript
 * @RateLimit({ limit: 5, windowMs: 60_000 })
 * @Post('login')
 * login() { ... }
 * ```
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

/**
 * Disables rate limiting for a specific route (e.g. internal webhooks).
 */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
