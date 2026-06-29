import { join } from 'path';
import { DataSource } from 'typeorm';
import { DEV_DB_PASSWORD, requireSecret } from './secret.util';

/**
 * Standalone TypeORM DataSource used by the TypeORM CLI
 * (migration:generate / run / revert / show).
 *
 * The running application does NOT use this file — it builds its options from
 * `databaseConfig` and runs pending migrations on boot (`migrationsRun: true`).
 * This exists so migrations can also be authored and applied from the command
 * line. Connection settings come from the environment, defaulting to the local
 * docker-compose Postgres.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.PGHOST ?? process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? process.env.POSTGRES_PORT ?? 5432),
  username: process.env.PGUSER ?? process.env.POSTGRES_USER ?? 'app_user',
  password: requireSecret(
    process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD,
    'POSTGRES_PASSWORD',
    DEV_DB_PASSWORD,
  ),
  database:
    process.env.PGDATABASE ?? process.env.POSTGRES_DB ?? 'enterprise_demo',
  // Globs resolve both the TS sources (ts-node CLI) and compiled JS (dist).
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
  synchronize: false,
});
