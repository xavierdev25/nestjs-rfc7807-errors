import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';

/**
 * Idempotency module.
 *
 * Provides the IdempotencyService and registers the IdempotencyInterceptor
 * globally. Routes must be decorated with @Idempotent() to activate the logic.
 */
@Module({
  providers: [
    IdempotencyService,
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
