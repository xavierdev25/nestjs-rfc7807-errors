import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionEntity } from '../../domain/entities/transaction.entity';
import {
  TransactionRepositoryPort,
  TransactionFilters,
  PaginatedResult,
} from '../../domain/ports/transaction.repository.port';
import { TenantAwareEntityManager } from '../../../../shared/database/rls/tenant-aware.entity-manager';
import { RequestContext } from '../../../../shared/context/request-context';

/**
 * TypeORM implementation of the TransactionRepositoryPort.
 *
 * Tenant isolation is enforced in TWO layers (defense in depth):
 *  1. Engine: PostgreSQL Row Level Security policies (see RlsBootstrapService).
 *  2. Application: every read is also explicitly scoped to the current tenant
 *     below, so a missing/misconfigured policy can never silently leak rows.
 */
@Injectable()
export class TypeOrmTransactionRepository implements TransactionRepositoryPort {
  private readonly logger = new Logger(TypeOrmTransactionRepository.name);

  constructor(
    @InjectRepository(TransactionEntity)
    private readonly repository: Repository<TransactionEntity>,
    private readonly tenantManager: TenantAwareEntityManager,
  ) {}

  async save(transaction: TransactionEntity): Promise<TransactionEntity> {
    return this.tenantManager.executeInTenantContext(async (manager) => {
      const repo = manager.getRepository(TransactionEntity);
      const saved = await repo.save(transaction);
      this.logger.debug(`Transaction saved: id=${saved.id}`);
      return saved;
    });
  }

  async update(transaction: TransactionEntity): Promise<TransactionEntity> {
    return this.tenantManager.executeInTenantContext(async (manager) => {
      const repo = manager.getRepository(TransactionEntity);
      const updated = await repo.save(transaction);
      this.logger.debug(
        `Transaction updated: id=${updated.id}, status=${updated.status}`,
      );
      return updated;
    });
  }

  async findById(id: string): Promise<TransactionEntity | null> {
    const tenantId = RequestContext.currentTenantId();
    // No tenant in context ⇒ no data. Never fall back to an unscoped lookup,
    // which would expose another tenant's row by id.
    if (!tenantId) {
      return null;
    }

    return this.tenantManager.queryInTenantContext(async (manager) => {
      const repo = manager.getRepository(TransactionEntity);
      return repo.findOne({ where: { id, tenantId } });
    });
  }

  async findAll(
    filters: TransactionFilters,
  ): Promise<PaginatedResult<TransactionEntity>> {
    const tenantId = RequestContext.currentTenantId();
    const page = Math.max(1, filters.page);
    const limit = Math.min(100, Math.max(1, filters.limit));

    // No tenant in context ⇒ empty result rather than an unscoped list scan.
    if (!tenantId) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    return this.tenantManager.queryInTenantContext(async (manager) => {
      const repo = manager.getRepository(TransactionEntity);
      const queryBuilder = repo
        .createQueryBuilder('tx')
        .where('tx.tenant_id = :tenantId', { tenantId });

      // Apply optional filters
      if (filters.status) {
        queryBuilder.andWhere('tx.status = :status', {
          status: filters.status,
        });
      }

      if (filters.type) {
        queryBuilder.andWhere('tx.type = :type', { type: filters.type });
      }

      // Apply pagination (page/limit normalized above)
      const skip = (page - 1) * limit;

      queryBuilder.orderBy('tx.created_at', 'DESC').skip(skip).take(limit);

      const [data, total] = await queryBuilder.getManyAndCount();

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    });
  }
}
