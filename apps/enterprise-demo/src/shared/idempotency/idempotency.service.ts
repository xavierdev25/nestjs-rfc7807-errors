import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

/**
 * Stored idempotency response structure.
 */
export interface StoredResponse {
  statusCode: number;
  body: unknown;
  headers?: Record<string, string>;
}

/**
 * Lua script for a safe lock release: deletes the key only if it still holds
 * the token we acquired it with. Without this compare-and-delete, a slow
 * request whose lock had already expired could delete a *different* request's
 * freshly-acquired lock, breaking the mutual exclusion guarantee.
 */
const RELEASE_LOCK_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

/**
 * Service responsible for managing idempotency keys in Redis.
 *
 * Uses Redis atomic operations (SET NX EX) for distributed locking
 * to prevent duplicate processing in high-concurrency scenarios.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly LOCK_PREFIX = 'idem:lock:';
  private readonly RESPONSE_PREFIX = 'idem:resp:';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Builds a scoped idempotency key: `tenantId:userId:clientKey`
   */
  buildKey(tenantId: string, userId: string, clientKey: string): string {
    return `${tenantId}:${userId}:${clientKey}`;
  }

  /**
   * Attempts to acquire a distributed lock for the given idempotency key.
   *
   * Uses Redis SET NX (set if not exists) with an expiration for atomicity.
   * The lock TTL is shorter than the response TTL to handle crashed processes.
   * The stored value is a unique, per-acquisition token so the lock can only be
   * released by its owner (see {@link releaseLock}).
   *
   * @param key - The scoped idempotency key
   * @param lockTtlSeconds - Lock expiration (default: 30s)
   * @returns The ownership token if the lock was obtained, or `null` if another
   *          process currently holds it.
   */
  async acquireLock(key: string, lockTtlSeconds = 30): Promise<string | null> {
    const lockKey = `${this.LOCK_PREFIX}${key}`;
    const token = randomUUID();
    const result = await this.redis.set(
      lockKey,
      token,
      'EX',
      lockTtlSeconds,
      'NX',
    );

    if (result === 'OK') {
      this.logger.debug(`Lock acquired for idempotency key: ${key}`);
      return token;
    }

    this.logger.debug(`Lock already held for idempotency key: ${key}`);
    return null;
  }

  /**
   * Releases the distributed lock for the given idempotency key, but only if it
   * still holds the token we acquired it with (atomic compare-and-delete).
   *
   * @returns `true` if this owner's lock was released, `false` if the lock had
   *          already expired / been taken over by another acquisition.
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
    const lockKey = `${this.LOCK_PREFIX}${key}`;
    const released = (await this.redis.eval(
      RELEASE_LOCK_SCRIPT,
      1,
      lockKey,
      token,
    )) as number;

    if (released === 1) {
      this.logger.debug(`Lock released for idempotency key: ${key}`);
      return true;
    }

    this.logger.debug(
      `Lock release skipped (not owner / already expired) for key: ${key}`,
    );
    return false;
  }

  /**
   * Stores the response for a completed idempotent operation.
   *
   * @param key - The scoped idempotency key
   * @param response - The response to cache
   * @param ttlSeconds - Time-to-live for the cached response
   */
  async storeResponse(
    key: string,
    response: StoredResponse,
    ttlSeconds: number,
  ): Promise<void> {
    const responseKey = `${this.RESPONSE_PREFIX}${key}`;
    const serialized = JSON.stringify(response);
    await this.redis.set(responseKey, serialized, 'EX', ttlSeconds);
    this.logger.debug(
      `Response stored for idempotency key: ${key} (TTL: ${ttlSeconds}s)`,
    );
  }

  /**
   * Retrieves a previously stored response for the given idempotency key.
   *
   * @returns The cached response or null if not found
   */
  async getStoredResponse(key: string): Promise<StoredResponse | null> {
    const responseKey = `${this.RESPONSE_PREFIX}${key}`;
    const data = await this.redis.get(responseKey);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as StoredResponse;
    } catch {
      this.logger.warn(`Corrupted idempotency response for key: ${key}`);
      await this.redis.del(responseKey);
      return null;
    }
  }
}
