import { NotFoundProblem } from '@xavierdev25/rfc7807-errors';

/**
 * Domain error thrown when a transaction is not found.
 */
export class TransactionNotFoundError extends NotFoundProblem {
  constructor(transactionId: string) {
    super({
      type: 'https://api.enterprise.com/errors/transaction-not-found',
      detail: `Transaction with ID '${transactionId}' was not found.`,
      instance: `/transactions/${transactionId}`,
      extensions: { transactionId },
    });
  }
}
