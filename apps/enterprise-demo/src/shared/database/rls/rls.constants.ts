/**
 * Name of the least-privilege PostgreSQL role the application impersonates
 * (via `SET LOCAL ROLE`) for every tenant-scoped transaction.
 *
 * It is NOSUPERUSER / NOBYPASSRLS and does not own the tables, so Row Level
 * Security policies are actually enforced against it — unlike the admin role
 * used for schema synchronization, which would otherwise bypass them.
 *
 * Must be a valid SQL identifier (it is interpolated into DDL/`SET ROLE`).
 */
export const RLS_APP_ROLE = 'rls_app';
