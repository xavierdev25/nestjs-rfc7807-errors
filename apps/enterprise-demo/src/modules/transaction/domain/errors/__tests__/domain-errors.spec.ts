import { InsufficientFundsError } from '../insufficient-funds.error';
import { TransactionNotFoundError } from '../transaction-not-found.error';
import { InvalidStatusTransitionError } from '../invalid-status-transition.error';
import { DuplicateTransactionError } from '../duplicate-transaction.error';
import { TransactionStatus } from '../../value-objects/transaction-status.enum';
import {
  UnprocessableEntityProblem,
  NotFoundProblem,
  ConflictProblem,
} from '@xavierdev25/rfc7807-errors';

describe('Domain Errors (RFC 7807)', () => {
  describe('InsufficientFundsError', () => {
    it('should be an instance of UnprocessableEntityProblem', () => {
      const error = new InsufficientFundsError();
      expect(error).toBeInstanceOf(UnprocessableEntityProblem);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have status 422', () => {
      const error = new InsufficientFundsError();
      const problem = error.toProblemDetail();
      expect(problem.status).toBe(422);
    });

    it('should include the correct type URI', () => {
      const error = new InsufficientFundsError();
      const problem = error.toProblemDetail();
      expect(problem.type).toBe(
        'https://api.enterprise.com/errors/insufficient-funds',
      );
    });

    it('should include extension members', () => {
      const error = new InsufficientFundsError({
        availableAmount: 500,
        requestedAmount: 1000,
        currency: 'USD',
      });
      const problem = error.toProblemDetail();
      expect(problem.availableAmount).toBe(500);
      expect(problem.requestedAmount).toBe(1000);
      expect(problem.currency).toBe('USD');
    });

    it('should have a default detail message', () => {
      const error = new InsufficientFundsError();
      expect(error.message).toContain('sufficient funds');
    });
  });

  describe('TransactionNotFoundError', () => {
    it('should be an instance of NotFoundProblem', () => {
      const error = new TransactionNotFoundError('tx-123');
      expect(error).toBeInstanceOf(NotFoundProblem);
    });

    it('should have status 404', () => {
      const error = new TransactionNotFoundError('tx-123');
      const problem = error.toProblemDetail();
      expect(problem.status).toBe(404);
    });

    it('should include the transaction ID in detail', () => {
      const error = new TransactionNotFoundError('tx-123');
      expect(error.message).toContain('tx-123');
    });

    it('should set the instance to the transaction URL', () => {
      const error = new TransactionNotFoundError('tx-123');
      const problem = error.toProblemDetail();
      expect(problem.instance).toBe('/transactions/tx-123');
    });

    it('should include transactionId as extension', () => {
      const error = new TransactionNotFoundError('tx-123');
      const problem = error.toProblemDetail();
      expect(problem.transactionId).toBe('tx-123');
    });
  });

  describe('InvalidStatusTransitionError', () => {
    it('should be an instance of ConflictProblem', () => {
      const error = new InvalidStatusTransitionError(
        'tx-1',
        TransactionStatus.PENDING,
        TransactionStatus.COMPLETED,
      );
      expect(error).toBeInstanceOf(ConflictProblem);
    });

    it('should have status 409', () => {
      const error = new InvalidStatusTransitionError(
        'tx-1',
        TransactionStatus.PENDING,
        TransactionStatus.COMPLETED,
      );
      const problem = error.toProblemDetail();
      expect(problem.status).toBe(409);
    });

    it('should include current and target statuses in detail', () => {
      const error = new InvalidStatusTransitionError(
        'tx-1',
        TransactionStatus.PENDING,
        TransactionStatus.COMPLETED,
      );
      expect(error.message).toContain('PENDING');
      expect(error.message).toContain('COMPLETED');
    });

    it('should include valid transitions as extension', () => {
      const error = new InvalidStatusTransitionError(
        'tx-1',
        TransactionStatus.PENDING,
        TransactionStatus.COMPLETED,
      );
      const problem = error.toProblemDetail();
      expect(problem.validTransitions).toContain(TransactionStatus.PROCESSING);
      expect(problem.validTransitions).toContain(TransactionStatus.CANCELLED);
    });
  });

  describe('DuplicateTransactionError', () => {
    it('should be an instance of ConflictProblem', () => {
      const error = new DuplicateTransactionError('key-123');
      expect(error).toBeInstanceOf(ConflictProblem);
    });

    it('should have status 409', () => {
      const error = new DuplicateTransactionError('key-123');
      const problem = error.toProblemDetail();
      expect(problem.status).toBe(409);
    });

    it('should include the idempotency key in detail', () => {
      const error = new DuplicateTransactionError('key-123');
      expect(error.message).toContain('key-123');
    });

    it('should include idempotencyKey as extension', () => {
      const error = new DuplicateTransactionError('key-123');
      const problem = error.toProblemDetail();
      expect(problem.idempotencyKey).toBe('key-123');
    });
  });
});
