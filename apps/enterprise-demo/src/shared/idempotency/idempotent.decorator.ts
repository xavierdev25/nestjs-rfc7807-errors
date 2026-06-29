import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for the @Idempotent() decorator.
 */
export const IDEMPOTENT_KEY = 'idempotent';

/**
 * Decorator to mark a route handler as idempotent.
 *
 * When applied, the IdempotencyInterceptor will:
 * 1. Check for an `X-Idempotency-Key` header
 * 2. If a cached response exists for this key, return it immediately
 * 3. If the key is being processed, return 409 Conflict
 * 4. Otherwise, execute the handler and cache the response
 *
 * @param ttlSeconds - Time-to-live for the cached response (default: 86400 = 24h)
 *
 * @example
 * ```typescript
 * @Post()
 * @Idempotent(86400)
 * create(@Body() dto: CreateDto) { ... }
 * ```
 */
export const Idempotent = (ttlSeconds = 86400) =>
  SetMetadata(IDEMPOTENT_KEY, { ttlSeconds });
