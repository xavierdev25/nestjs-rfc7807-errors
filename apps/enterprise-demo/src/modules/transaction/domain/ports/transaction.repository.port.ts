import { TransactionEntity } from '../entities/transaction.entity';
import {
  TransactionStatus,
  TransactionType,
} from '../value-objects/transaction-status.enum';

/**
 * Transaction Repository Port (DIP).
 *
 * Defines the contract for persisting and retrieving transactions.
 * The infrastructure layer provides the concrete implementation (TypeORM).
 */
export interface TransactionRepositoryPort {
  /**
   * Saves a new transaction entity.
   */
  save(transaction: TransactionEntity): Promise<TransactionEntity>;

  /**
   * Updates an existing transaction entity.
   */
  update(transaction: TransactionEntity): Promise<TransactionEntity>;

  /**
   * Finds a transaction by its unique identifier.
   * Returns null if not found.
   */
  findById(id: string): Promise<TransactionEntity | null>;

  /**
   * Finds transactions with optional filters and pagination.
   */
  findAll(
    filters: TransactionFilters,
  ): Promise<PaginatedResult<TransactionEntity>>;
}

/**
 * DI token for the TransactionRepositoryPort.
 */
export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

/**
 * Filter options for querying transactions.
 */
export interface TransactionFilters {
  status?: TransactionStatus;
  type?: TransactionType;
  page: number;
  limit: number;
}

/**
 * Paginated result wrapper.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
