import { ConflictProblem } from '@xavierdev25/rfc7807-errors';

/**
 * Domain error thrown when a duplicate transaction is detected.
 */
export class DuplicateTransactionError extends ConflictProblem {
  constructor(idempotencyKey: string) {
    super({
      type: 'https://api.enterprise.com/errors/duplicate-transaction',
      detail: `A transaction with idempotency key '${idempotencyKey}' has already been processed.`,
      instance: '/transactions',
      extensions: { idempotencyKey },
    });
  }
}
