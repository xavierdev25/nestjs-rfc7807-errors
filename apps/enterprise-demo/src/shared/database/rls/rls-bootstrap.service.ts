import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RLS_APP_ROLE } from './rls.constants';

/**
 * Tables that must enforce tenant isolation via Row Level Security.
 *
 * Each table listed here is expected to expose a `tenant_id UUID` column.
 * Background/relay tables (e.g. `outbox_events`) are intentionally excluded
 * because they are processed outside of any request/tenant context.
 */
const RLS_PROTECTED_TABLES = ['transactions'] as const;

/**
 * RLS Bootstrap Service.
 *
 * The previous design set `app.current_tenant_id` per transaction but never
 * created the policies that consume it, so isolation was effectively a no-op.
 * This service closes that gap by provisioning the engine-level guard rails
 * **after** the schema exists (TypeORM `synchronize` runs during module init,
 * before `OnApplicationBootstrap`).
 *
 * It is fully self-contained and idempotent:
 *   1. (Re)creates the `get_current_tenant_id()` helper — no dependency on the
 *      docker `init-db.sh`, so it also works in CI where that script is absent.
 *   2. Creates a least-privilege application role ({@link RLS_APP_ROLE}) that is
 *      NOSUPERUSER / NOBYPASSRLS. This is the critical piece: PostgreSQL lets
 *      superusers AND the table owner bypass RLS, so the app must run its
 *      tenant queries under a role that has neither power (see
 *      TenantAwareEntityManager, which `SET LOCAL ROLE`s to it per transaction).
 *   3. Enables AND forces RLS and creates the `tenant_isolation` policy.
 *
 * Runs on every boot; all statements use IF EXISTS / OR REPLACE / DO-guards so
 * repeated execution is safe (important under `synchronize: true`, which drops
 * and recreates the schema — and thus the policies/grants — on each start).
 */
@Injectable()
export class RlsBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RlsBootstrapService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.dataSource.options.type !== 'postgres') {
      this.logger.warn(
        `RLS bootstrap skipped: driver "${this.dataSource.options.type}" does not support Row Level Security.`,
      );
      return;
    }

    await this.ensureTenantHelperFunction();
    await this.ensureRestrictedRole();

    for (const table of RLS_PROTECTED_TABLES) {
      await this.applyTenantIsolation(table);
    }
  }

  /**
   * Creates the SECURITY-safe accessor used by every policy. Returning NULL on
   * malformed/missing settings means "no tenant" requests match no rows rather
   * than throwing on the UUID cast.
   */
  private async ensureTenantHelperFunction(): Promise<void> {
    await this.dataSource.query(`
      CREATE OR REPLACE FUNCTION get_current_tenant_id()
      RETURNS UUID
      LANGUAGE plpgsql
      STABLE
      AS $$
      BEGIN
        RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
      EXCEPTION
        WHEN OTHERS THEN
          RETURN NULL;
      END;
      $$;
    `);
  }

  /**
   * Provisions the non-privileged role the application impersonates for every
   * tenant-scoped query. Because it is NOSUPERUSER / NOBYPASSRLS and is not the
   * table owner, RLS policies are actually enforced against it.
   *
   * The connecting (admin) role is granted membership so it can `SET ROLE` to
   * it even when it is not a superuser.
   */
  private async ensureRestrictedRole(): Promise<void> {
    await this.dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${RLS_APP_ROLE}') THEN
          CREATE ROLE ${RLS_APP_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        END IF;
      END
      $$;
    `);

    // Idempotent: ensure the role keeps least-privilege attributes and the
    // admin role can assume it.
    await this.dataSource.query(
      `ALTER ROLE ${RLS_APP_ROLE} NOSUPERUSER NOBYPASSRLS`,
    );
    await this.dataSource.query(`GRANT ${RLS_APP_ROLE} TO CURRENT_USER`);
    await this.dataSource.query(
      `GRANT USAGE ON SCHEMA public TO ${RLS_APP_ROLE}`,
    );
    // Grant DML on existing + future tables/sequences so the role can operate
    // (RLS still constrains *which rows* it may touch).
    await this.dataSource.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${RLS_APP_ROLE}`,
    );
    await this.dataSource.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${RLS_APP_ROLE}`,
    );
    await this.dataSource.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${RLS_APP_ROLE}`,
    );
  }

  /**
   * Enables + forces RLS on a table and (re)creates the tenant isolation policy.
   * Skips gracefully if the table has not been created yet.
   */
  private async applyTenantIsolation(table: string): Promise<void> {
    const exists = await this.dataSource.query(
      `SELECT to_regclass($1) AS reg`,
      [`public.${table}`],
    );

    if (!exists?.[0]?.reg) {
      this.logger.warn(
        `RLS bootstrap skipped for "${table}": table does not exist yet.`,
      );
      return;
    }

    // ENABLE makes the policy apply to non-owners; FORCE additionally subjects
    // the table owner. Neither covers superusers — that is why the app runs as
    // the restricted role above.
    await this.dataSource.query(
      `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
    );
    await this.dataSource.query(
      `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
    );

    // DROP + CREATE keeps the policy definition authoritative across deploys.
    await this.dataSource.query(
      `DROP POLICY IF EXISTS tenant_isolation ON "${table}"`,
    );
    await this.dataSource.query(`
      CREATE POLICY tenant_isolation ON "${table}"
        USING (tenant_id = get_current_tenant_id())
        WITH CHECK (tenant_id = get_current_tenant_id())
    `);

    // Ensure the restricted role can reach this specific table too.
    await this.dataSource.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO ${RLS_APP_ROLE}`,
    );

    this.logger.log(`Row Level Security enforced on "${table}".`);
  }
}
