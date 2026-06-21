import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

/**
 * Factory function for ioredis client.
 * Configures connection, retry strategy, and keepAlive.
 */
export const createRedisClient = (configService: ConfigService): Redis => {
  const options: RedisOptions = {
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: configService.get<number>('REDIS_PORT', 6379),
    password: configService.get<string>('REDIS_PASSWORD', ''),
    db: configService.get<number>('REDIS_DB', 0),
    keyPrefix: 'enterprise:',
    lazyConnect: false,
    keepAlive: 30000,
    retryStrategy: (times: number): number | null => {
      if (times > 10) {
        return null; // Stop retrying after 10 attempts
      }
      return Math.min(times * 200, 5000); // Exponential backoff, max 5s
    },
    maxRetriesPerRequest: 3,
  };

  return new Redis(options);
};
