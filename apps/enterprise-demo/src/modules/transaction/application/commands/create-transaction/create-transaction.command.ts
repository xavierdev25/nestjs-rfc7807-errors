import { TransactionType } from '../../../domain/value-objects/transaction-status.enum';

/**
 * CQRS Command to create a new transaction.
 */
export class CreateTransactionCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly type: TransactionType,
    public readonly amountInCents: number,
    public readonly currency: string,
    public readonly description?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {}
}
