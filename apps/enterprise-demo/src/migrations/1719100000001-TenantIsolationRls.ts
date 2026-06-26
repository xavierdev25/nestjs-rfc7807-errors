import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_APP_ROLE } from '../shared/database/rls/rls.constants';

/**
 * Provisions engine-level multi-tenant isolation via PostgreSQL Row Level
 * Security. This replaces the previous runtime `RlsBootstrapService`: the same
 * guarantees, but now versioned and applied deterministically by the migration
 * runner before the app serves traffic.
 *
 * Layers provisioned:
 *   - `get_current_tenant_id()` accessor used by the policy.
 *   - A least-privilege role ({@link RLS_APP_ROLE}) — NOSUPERUSER/NOBYPASSRLS —
 *     that the app impersonates per transaction (SET LOCAL ROLE) so RLS is
 *     actually enforced (superusers and the table owner would otherwise bypass).
 *   - ENABLE + FORCE RLS and the `tenant_isolation` policy on `transactions`.
 *
 * Statements are idempotent (OR REPLACE / DO-guards / IF EXISTS) so this is
 * safe under the test harness, which drops the schema and re-runs migrations on
 * every run while the cluster-level role persists.
 */
export class TenantIsolationRls1719100000001 implements MigrationInterface {
  name = 'TenantIsolationRls1719100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
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

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${RLS_APP_ROLE}') THEN
          CREATE ROLE ${RLS_APP_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(
      `ALTER ROLE ${RLS_APP_ROLE} NOSUPERUSER NOBYPASSRLS`,
    );
    await queryRunner.query(`GRANT ${RLS_APP_ROLE} TO CURRENT_USER`);
    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO ${RLS_APP_ROLE}`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${RLS_APP_ROLE}`,
    );
    await queryRunner.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${RLS_APP_ROLE}`,
    );
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${RLS_APP_ROLE}`,
    );

    await queryRunner.query(
      `ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS tenant_isolation ON "transactions"`,
    );
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON "transactions"
        USING (tenant_id = get_current_tenant_id())
        WITH CHECK (tenant_id = get_current_tenant_id())
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS tenant_isolation ON "transactions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS get_current_tenant_id()`);
    // The role is cluster-level and may own grants elsewhere; leave it in place.
  }
}
