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

/**
 * TypeORM implementation of the TransactionRepositoryPort.
 *
 * Uses TenantAwareEntityManager for RLS-enforced queries,
 * ensuring that each operation runs with the correct tenant context.
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
    return this.tenantManager.queryInTenantContext(async (manager) => {
      const repo = manager.getRepository(TransactionEntity);
      return repo.findOne({ where: { id } });
    });
  }

  async findAll(
    filters: TransactionFilters,
  ): Promise<PaginatedResult<TransactionEntity>> {
    return this.tenantManager.queryInTenantContext(async (manager) => {
      const repo = manager.getRepository(TransactionEntity);
      const queryBuilder = repo.createQueryBuilder('tx');

      // Apply optional filters
      if (filters.status) {
        queryBuilder.andWhere('tx.status = :status', {
          status: filters.status,
        });
      }

      if (filters.type) {
        queryBuilder.andWhere('tx.type = :type', { type: filters.type });
      }

      // Apply pagination
      const page = Math.max(1, filters.page);
      const limit = Math.min(100, Math.max(1, filters.limit));
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
