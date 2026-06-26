import { join } from 'path';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * Factory function for TypeORM configuration.
 * Reads connection parameters from environment variables via ConfigService.
 *
 * Schema management is migration-driven (`synchronize: false`): pending
 * migrations — including the engine-level RLS provisioning — run automatically
 * on boot (`migrationsRun: true`), so dev, test and prod share one deterministic
 * source of truth. Tests additionally `dropSchema` first to start from scratch,
 * which also exercises the migrations end to end on every run.
 */
export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isTest = configService.get<string>('NODE_ENV') === 'test';

  return {
    type: 'postgres',
    host: configService.get<string>(
      isTest ? 'TEST_DB_HOST' : 'POSTGRES_HOST',
      'localhost',
    ),
    port: configService.get<number>(
      isTest ? 'TEST_DB_PORT' : 'POSTGRES_PORT',
      5432,
    ),
    database: configService.get<string>(
      isTest ? 'TEST_DB_NAME' : 'POSTGRES_DB',
      isTest ? 'test_db' : 'enterprise_demo',
    ),
    username: configService.get<string>(
      isTest ? 'TEST_DB_USER' : 'POSTGRES_USER',
      'app_user',
    ),
    password: configService.get<string>(
      isTest ? 'TEST_DB_PASSWORD' : 'POSTGRES_PASSWORD',
      'S3cur3P@ssw0rd!2026',
    ),
    ssl: configService.get<string>('POSTGRES_SSL', 'false') === 'true',
    autoLoadEntities: true,
    // Versioned migrations are the single source of truth — never auto-sync.
    synchronize: false,
    migrationsRun: true,
    // Resolves TS sources (ts-jest e2e) and compiled JS (built app) alike.
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
    dropSchema: isTest, // Tests start clean, then migrations rebuild everything
    logging:
      configService.get<string>('NODE_ENV', 'development') === 'development'
        ? ['error', 'warn', 'migration']
        : ['error'],
    // Connection pool settings
    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },
  };
};
