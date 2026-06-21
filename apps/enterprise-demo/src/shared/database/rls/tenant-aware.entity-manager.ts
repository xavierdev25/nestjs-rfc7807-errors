import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { RequestContext } from '../../context/request-context';

/**
 * Tenant-aware EntityManager wrapper.
 *
 * Wraps TypeORM's EntityManager to automatically inject RLS context
 * (tenant_id and user_id) into the PostgreSQL session before executing queries.
 *
 * Every operation runs inside a transaction with SET LOCAL to scope
 * the session variables to the current transaction only.
 */
@Injectable()
export class TenantAwareEntityManager {
  private readonly logger = new Logger(TenantAwareEntityManager.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Executes a callback within a transaction that has RLS context set.
   *
   * @param work - Callback receiving a tenant-scoped EntityManager
   * @returns The result of the callback
   */
  async executeInTenantContext<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const tenantId = RequestContext.currentTenantId();
    const userId = RequestContext.currentUserId();

    return this.dataSource.transaction(async (manager: EntityManager) => {
      // Set RLS session variables scoped to this transaction
      if (tenantId) {
        await manager.query(
          `SELECT set_config('app.current_tenant_id', $1, true)`,
          [tenantId],
        );
      }

      if (userId) {
        await manager.query(
          `SELECT set_config('app.current_user_id', $1, true)`,
          [userId],
        );
      }

      this.logger.debug(
        `RLS context set: tenant=${tenantId ?? 'null'}, user=${userId ?? 'null'}`,
      );

      return work(manager);
    });
  }

  /**
   * Executes a read-only query within RLS context (no explicit transaction needed
   * for simple SELECTs, but we still need the session variables set).
   */
  async queryInTenantContext<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.executeInTenantContext(work);
  }
}
