import {
  TransactionStatus,
  TransactionType,
  isValidTransition,
  getValidTransitions,
} from '../transaction-status.enum';

describe('TransactionStatus State Machine', () => {
  describe('TransactionStatus enum', () => {
    it('should have all expected statuses', () => {
      expect(TransactionStatus.PENDING).toBe('PENDING');
      expect(TransactionStatus.PROCESSING).toBe('PROCESSING');
      expect(TransactionStatus.COMPLETED).toBe('COMPLETED');
      expect(TransactionStatus.FAILED).toBe('FAILED');
      expect(TransactionStatus.CANCELLED).toBe('CANCELLED');
    });
  });

  describe('TransactionType enum', () => {
    it('should have all expected types', () => {
      expect(TransactionType.PAYMENT).toBe('PAYMENT');
      expect(TransactionType.REFUND).toBe('REFUND');
      expect(TransactionType.RESERVATION).toBe('RESERVATION');
    });
  });

  describe('isValidTransition', () => {
    // Valid transitions
    it.each([
      [TransactionStatus.PENDING, TransactionStatus.PROCESSING],
      [TransactionStatus.PENDING, TransactionStatus.CANCELLED],
      [TransactionStatus.PROCESSING, TransactionStatus.COMPLETED],
      [TransactionStatus.PROCESSING, TransactionStatus.FAILED],
      [TransactionStatus.FAILED, TransactionStatus.PENDING],
    ])('should allow transition from %s to %s', (from, to) => {
      expect(isValidTransition(from, to)).toBe(true);
    });

    // Invalid transitions
    it.each([
      [TransactionStatus.PENDING, TransactionStatus.COMPLETED],
      [TransactionStatus.PENDING, TransactionStatus.FAILED],
      [TransactionStatus.PROCESSING, TransactionStatus.CANCELLED],
      [TransactionStatus.PROCESSING, TransactionStatus.PENDING],
      [TransactionStatus.COMPLETED, TransactionStatus.PENDING],
      [TransactionStatus.COMPLETED, TransactionStatus.FAILED],
      [TransactionStatus.COMPLETED, TransactionStatus.CANCELLED],
      [TransactionStatus.CANCELLED, TransactionStatus.PENDING],
      [TransactionStatus.CANCELLED, TransactionStatus.PROCESSING],
      [TransactionStatus.FAILED, TransactionStatus.COMPLETED],
      [TransactionStatus.FAILED, TransactionStatus.CANCELLED],
    ])('should reject transition from %s to %s', (from, to) => {
      expect(isValidTransition(from, to)).toBe(false);
    });

    it('should reject self-transitions', () => {
      Object.values(TransactionStatus).forEach((status) => {
        expect(isValidTransition(status, status)).toBe(false);
      });
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid targets for PENDING', () => {
      const valid = getValidTransitions(TransactionStatus.PENDING);
      expect(valid).toContain(TransactionStatus.PROCESSING);
      expect(valid).toContain(TransactionStatus.CANCELLED);
      expect(valid).toHaveLength(2);
    });

    it('should return valid targets for PROCESSING', () => {
      const valid = getValidTransitions(TransactionStatus.PROCESSING);
      expect(valid).toContain(TransactionStatus.COMPLETED);
      expect(valid).toContain(TransactionStatus.FAILED);
      expect(valid).toHaveLength(2);
    });

    it('should return empty array for terminal states', () => {
      expect(getValidTransitions(TransactionStatus.COMPLETED)).toHaveLength(0);
      expect(getValidTransitions(TransactionStatus.CANCELLED)).toHaveLength(0);
    });

    it('should return PENDING for FAILED (retry)', () => {
      const valid = getValidTransitions(TransactionStatus.FAILED);
      expect(valid).toContain(TransactionStatus.PENDING);
      expect(valid).toHaveLength(1);
    });
  });
});
