import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { databaseConfig } from '../../config/database.config';
import { RlsInterceptor } from './rls/rls.interceptor';
import { RlsBootstrapService } from './rls/rls-bootstrap.service';
import { TenantAwareEntityManager } from './rls/tenant-aware.entity-manager';

/**
 * Database module.
 *
 * Configures TypeORM with PostgreSQL and provides:
 * - RlsBootstrapService: provisions engine-level RLS policies on boot
 * - Global RLS interceptor for tenant context logging
 * - TenantAwareEntityManager for RLS-enforced queries
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
    RlsBootstrapService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RlsInterceptor,
    },
  ],
  exports: [TenantAwareEntityManager],
})
export class DatabaseModule {}
