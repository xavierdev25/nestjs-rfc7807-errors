import {
  TransactionStatus,
  TransactionType,
} from '../../../domain/value-objects/transaction-status.enum';

/**
 * CQRS Query to list transactions with filters and pagination.
 */
export class ListTransactionsQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 20,
    public readonly status?: TransactionStatus,
    public readonly type?: TransactionType,
  ) {}
}
