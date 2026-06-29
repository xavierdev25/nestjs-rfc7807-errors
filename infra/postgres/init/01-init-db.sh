#!/bin/bash
# ==============================================================================
# PostgreSQL Initialization Script
# Runs once when the container is first created (via /docker-entrypoint-initdb.d/).
#
# This script:
# 1. Creates the application database (if not exists)
# 2. Enables required extensions (uuid-ossp, pgcrypto)
# 3. Creates the application schema with RLS-ready structure
# 4. Sets up a read-only role for observability/reporting
# ==============================================================================

set -euo pipefail

echo "🔧 [init-db] Initializing PostgreSQL for Enterprise Demo..."

# Use the POSTGRES_DB from environment (set in docker-compose)
DB_NAME="${POSTGRES_DB:-enterprise_demo}"
TEST_DB_NAME="test_db"
DB_USER="${POSTGRES_USER:-app_user}"
# Observer role password — overridable via environment, never hardcode secrets.
OBSERVER_PASSWORD="${OBSERVER_PASSWORD:-observer_readonly_2026}"

echo "Creating test database: $TEST_DB_NAME"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
    SELECT 'CREATE DATABASE $TEST_DB_NAME'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$TEST_DB_NAME')\\gexec
EOSQL

# ==============================================================================
# 1. Extensions
# ==============================================================================

for DB in "$DB_NAME" "$TEST_DB_NAME"; do
    echo "Initializing database: $DB"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB" <<-EOSQL
    -- UUID generation for primary keys
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Cryptographic functions (for hashing, JWT token storage, etc.)
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    -- Performance monitoring
    CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

    COMMENT ON EXTENSION "uuid-ossp" IS 'RFC 4122 UUID generation for primary keys';
    COMMENT ON EXTENSION "pgcrypto" IS 'Cryptographic functions for password hashing';
EOSQL

echo "✅ [init-db] Extensions created: uuid-ossp, pgcrypto, pg_stat_statements"

# ==============================================================================
# 2. Row Level Security (RLS) Preparation
# ==============================================================================
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB" <<-EOSQL
    -- Application variable for tenant isolation (set per-connection)
    -- Usage: SET app.current_tenant_id = '<tenant-uuid>';
    -- The RLS policies (Phase 3) will reference this via current_setting('app.current_tenant_id')

    -- Create a function to retrieve the current tenant ID safely
    CREATE OR REPLACE FUNCTION get_current_tenant_id()
    RETURNS UUID
    LANGUAGE plpgsql
    STABLE
    AS \$\$
    BEGIN
        RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN NULL;
    END;
    \$\$;

    COMMENT ON FUNCTION get_current_tenant_id() IS
        'Returns the current tenant UUID from the session variable app.current_tenant_id. '
        'Used by RLS policies to enforce data isolation between tenants.';

    -- Create a function to retrieve the current user ID safely
    CREATE OR REPLACE FUNCTION get_current_user_id()
    RETURNS UUID
    LANGUAGE plpgsql
    STABLE
    AS \$\$
    BEGIN
        RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN NULL;
    END;
    \$\$;

    COMMENT ON FUNCTION get_current_user_id() IS
        'Returns the current user UUID from the session variable app.current_user_id. '
        'Used by RLS policies for user-scoped data access.';
EOSQL

    echo "✅ [init-db] RLS helper functions created for $DB"
done

# ==============================================================================
# 3. Read-only role for observability (optional)
# ==============================================================================
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'readonly_observer') THEN
            CREATE ROLE readonly_observer WITH LOGIN PASSWORD '${OBSERVER_PASSWORD}';
            GRANT CONNECT ON DATABASE ${DB_NAME} TO readonly_observer;
            GRANT USAGE ON SCHEMA public TO readonly_observer;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public
                GRANT SELECT ON TABLES TO readonly_observer;
        END IF;
    END
    \$\$;
EOSQL

echo "✅ [init-db] Read-only observer role created"
echo "🎉 [init-db] PostgreSQL initialization complete!"
