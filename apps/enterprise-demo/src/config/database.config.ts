import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * Factory function for TypeORM configuration.
 * Reads connection parameters from environment variables via ConfigService.
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
    synchronize:
      isTest ||
      configService.get<string>('NODE_ENV', 'development') === 'development',
    dropSchema: isTest, // Clean db completely on tests
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
