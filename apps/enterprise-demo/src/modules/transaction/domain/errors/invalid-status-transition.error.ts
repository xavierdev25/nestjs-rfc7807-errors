import { ConflictProblem } from '@xavierdev25/rfc7807-errors';
import {
  TransactionStatus,
  getValidTransitions,
} from '../value-objects/transaction-status.enum';

/**
 * Domain error thrown when an invalid state transition is attempted.
 */
export class InvalidStatusTransitionError extends ConflictProblem {
  constructor(
    transactionId: string,
    currentStatus: TransactionStatus,
    targetStatus: TransactionStatus,
  ) {
    const validTargets = getValidTransitions(currentStatus);
    super({
      type: 'https://api.enterprise.com/errors/invalid-status-transition',
      detail:
        `Cannot transition transaction '${transactionId}' from '${currentStatus}' to '${targetStatus}'. ` +
        `Valid transitions from '${currentStatus}': [${validTargets.join(', ')}].`,
      instance: `/transactions/${transactionId}`,
      extensions: {
        transactionId,
        currentStatus,
        targetStatus,
        validTransitions: validTargets,
      },
    });
  }
}
