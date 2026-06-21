import { Inject, Injectable, Logger } from '@nestjs/common';
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
 * Lock status for an idempotency key.
 */
export enum LockStatus {
  ACQUIRED = 'acquired',
  ALREADY_LOCKED = 'already_locked',
}

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
   *
   * @param key - The scoped idempotency key
   * @param lockTtlSeconds - Lock expiration (default: 30s)
   * @returns ACQUIRED if lock was obtained, ALREADY_LOCKED if another process holds it
   */
  async acquireLock(key: string, lockTtlSeconds = 30): Promise<LockStatus> {
    const lockKey = `${this.LOCK_PREFIX}${key}`;
    const result = await this.redis.set(
      lockKey,
      'processing',
      'EX',
      lockTtlSeconds,
      'NX',
    );

    if (result === 'OK') {
      this.logger.debug(`Lock acquired for idempotency key: ${key}`);
      return LockStatus.ACQUIRED;
    }

    this.logger.debug(`Lock already held for idempotency key: ${key}`);
    return LockStatus.ALREADY_LOCKED;
  }

  /**
   * Releases the distributed lock for the given idempotency key.
   */
  async releaseLock(key: string): Promise<void> {
    const lockKey = `${this.LOCK_PREFIX}${key}`;
    await this.redis.del(lockKey);
    this.logger.debug(`Lock released for idempotency key: ${key}`);
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
