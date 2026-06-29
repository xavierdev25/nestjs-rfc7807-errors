import { UnprocessableEntityProblem } from '@xavierdev25/rfc7807-errors';

/**
 * Domain error thrown when a transaction cannot be processed
 * due to insufficient funds in the source account.
 */
export class InsufficientFundsError extends UnprocessableEntityProblem {
  constructor(options?: {
    detail?: string;
    availableAmount?: number;
    requestedAmount?: number;
    currency?: string;
  }) {
    super({
      type: 'https://api.enterprise.com/errors/insufficient-funds',
      detail:
        options?.detail ??
        'The account does not have sufficient funds to complete this transaction.',
      instance: '/transactions',
      extensions: {
        availableAmount: options?.availableAmount,
        requestedAmount: options?.requestedAmount,
        currency: options?.currency,
      },
    });
  }
}
