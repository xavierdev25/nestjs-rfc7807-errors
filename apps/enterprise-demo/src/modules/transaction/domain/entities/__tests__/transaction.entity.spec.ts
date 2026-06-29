import { TransactionEntity } from '../transaction.entity';
import {
  TransactionStatus,
  TransactionType,
} from '../../value-objects/transaction-status.enum';
import { InvalidStatusTransitionError } from '../../errors/invalid-status-transition.error';

/**
 * Creates a TransactionEntity with sensible defaults.
 */
function createTransaction(
  overrides: Partial<TransactionEntity> = {},
): TransactionEntity {
  const tx = new TransactionEntity();
  tx.id = 'tx-test-uuid';
  tx.tenantId = 'tenant-1';
  tx.userId = 'user-1';
  tx.type = TransactionType.PAYMENT;
  tx.status = TransactionStatus.PENDING;
  tx.amountInCents = 5000;
  tx.currency = 'USD';
  tx.description = 'Test payment';
  tx.metadata = null;
  tx.externalId = null;
  tx.failureReason = null;
  tx.createdAt = new Date();
  tx.updatedAt = new Date();
  Object.assign(tx, overrides);
  return tx;
}

describe('TransactionEntity', () => {
  describe('markAsProcessing', () => {
    it('should transition from PENDING to PROCESSING', () => {
      const tx = createTransaction();
      tx.markAsProcessing();
      expect(tx.status).toBe(TransactionStatus.PROCESSING);
    });

    it('should throw on invalid transition from COMPLETED', () => {
      const tx = createTransaction({ status: TransactionStatus.COMPLETED });
      expect(() => tx.markAsProcessing()).toThrow(InvalidStatusTransitionError);
    });

    it('should throw on invalid transition from CANCELLED', () => {
      const tx = createTransaction({ status: TransactionStatus.CANCELLED });
      expect(() => tx.markAsProcessing()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('complete', () => {
    it('should transition from PROCESSING to COMPLETED with externalId', () => {
      const tx = createTransaction({ status: TransactionStatus.PROCESSING });
      tx.complete('PAY-12345678');
      expect(tx.status).toBe(TransactionStatus.COMPLETED);
      expect(tx.externalId).toBe('PAY-12345678');
    });

    it('should throw on invalid transition from PENDING', () => {
      const tx = createTransaction();
      expect(() => tx.complete('PAY-123')).toThrow(
        InvalidStatusTransitionError,
      );
    });
  });

  describe('fail', () => {
    it('should transition from PROCESSING to FAILED with reason', () => {
      const tx = createTransaction({ status: TransactionStatus.PROCESSING });
      tx.fail('Card declined');
      expect(tx.status).toBe(TransactionStatus.FAILED);
      expect(tx.failureReason).toBe('Card declined');
    });

    it('should throw on invalid transition from PENDING', () => {
      const tx = createTransaction();
      expect(() => tx.fail('error')).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('cancel', () => {
    it('should transition from PENDING to CANCELLED', () => {
      const tx = createTransaction();
      tx.cancel();
      expect(tx.status).toBe(TransactionStatus.CANCELLED);
    });

    it('should throw on invalid transition from PROCESSING', () => {
      const tx = createTransaction({ status: TransactionStatus.PROCESSING });
      expect(() => tx.cancel()).toThrow(InvalidStatusTransitionError);
    });

    it('should throw on invalid transition from COMPLETED', () => {
      const tx = createTransaction({ status: TransactionStatus.COMPLETED });
      expect(() => tx.cancel()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('retry', () => {
    it('should transition from FAILED to PENDING and clear failureReason', () => {
      const tx = createTransaction({
        status: TransactionStatus.FAILED,
        failureReason: 'Card declined',
      });
      tx.retry();
      expect(tx.status).toBe(TransactionStatus.PENDING);
      expect(tx.failureReason).toBeNull();
    });

    it('should throw on invalid transition from COMPLETED', () => {
      const tx = createTransaction({ status: TransactionStatus.COMPLETED });
      expect(() => tx.retry()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('isTerminal', () => {
    it('should return true for COMPLETED', () => {
      const tx = createTransaction({ status: TransactionStatus.COMPLETED });
      expect(tx.isTerminal()).toBe(true);
    });

    it('should return true for CANCELLED', () => {
      const tx = createTransaction({ status: TransactionStatus.CANCELLED });
      expect(tx.isTerminal()).toBe(true);
    });

    it('should return false for PENDING', () => {
      const tx = createTransaction();
      expect(tx.isTerminal()).toBe(false);
    });

    it('should return false for PROCESSING', () => {
      const tx = createTransaction({ status: TransactionStatus.PROCESSING });
      expect(tx.isTerminal()).toBe(false);
    });

    it('should return false for FAILED', () => {
      const tx = createTransaction({ status: TransactionStatus.FAILED });
      expect(tx.isTerminal()).toBe(false);
    });
  });

  describe('full lifecycle', () => {
    it('should complete the happy path: PENDING → PROCESSING → COMPLETED', () => {
      const tx = createTransaction();
      expect(tx.status).toBe(TransactionStatus.PENDING);

      tx.markAsProcessing();
      expect(tx.status).toBe(TransactionStatus.PROCESSING);

      tx.complete('PAY-ABC');
      expect(tx.status).toBe(TransactionStatus.COMPLETED);
      expect(tx.externalId).toBe('PAY-ABC');
      expect(tx.isTerminal()).toBe(true);
    });

    it('should handle failure and retry: PENDING → PROCESSING → FAILED → PENDING', () => {
      const tx = createTransaction();
      tx.markAsProcessing();
      tx.fail('Timeout');
      expect(tx.status).toBe(TransactionStatus.FAILED);
      expect(tx.failureReason).toBe('Timeout');

      tx.retry();
      expect(tx.status).toBe(TransactionStatus.PENDING);
      expect(tx.failureReason).toBeNull();
    });
  });
});
