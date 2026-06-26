import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { databaseConfig } from '../../config/database.config';
import { RlsInterceptor } from './rls/rls.interceptor';
import { TenantAwareEntityManager } from './rls/tenant-aware.entity-manager';

/**
 * Database module.
 *
 * Configures TypeORM with PostgreSQL and provides:
 * - Global RLS interceptor for tenant context logging
 * - TenantAwareEntityManager for RLS-enforced queries
 *
 * Engine-level RLS (policies, the rls_app role, grants) is provisioned by the
 * versioned migrations that run on boot — see `migrations/*TenantIsolationRls*`.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
      inject: [ConfigService],
    }),
  ],
  providers: [
    TenantAwareEntityManager,
    {
      provide: APP_INTERCEPTOR,
      useClass: RlsInterceptor,
    },
  ],
  exports: [TenantAwareEntityManager],
})
export class DatabaseModule {}
