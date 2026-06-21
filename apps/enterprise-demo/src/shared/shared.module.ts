import { Module } from '@nestjs/common';
import { RequestContextModule } from './context/request-context.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { OutboxModule } from './outbox/outbox.module';

/**
 * Shared module aggregating all cross-cutting concerns.
 *
 * Imports order matters:
 * 1. RequestContext — must be first (middleware runs before guards)
 * 2. Redis — required by IdempotencyModule
 * 3. Database — TypeORM + RLS
 * 4. Auth — JWT guard (runs after middleware, before interceptors)
 * 5. Idempotency — interceptor (runs after guards)
 */
@Module({
  imports: [
    RequestContextModule,
    RedisModule,
    DatabaseModule,
    AuthModule,
    IdempotencyModule,
    OutboxModule,
  ],
  exports: [
    RequestContextModule,
    RedisModule,
    DatabaseModule,
    AuthModule,
    IdempotencyModule,
    OutboxModule,
  ],
})
export class SharedModule {}
