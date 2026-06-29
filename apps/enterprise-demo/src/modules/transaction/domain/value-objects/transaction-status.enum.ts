/**
 * Transaction status state machine.
 *
 * Valid transitions:
 *   PENDING → PROCESSING
 *   PROCESSING → COMPLETED | FAILED
 *   PENDING → CANCELLED
 *   FAILED → PENDING (retry)
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Transaction type classification.
 */
export enum TransactionType {
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  RESERVATION = 'RESERVATION',
}

/**
 * Valid state transition map.
 * Key = current status, Value = set of valid target statuses.
 */
const VALID_TRANSITIONS: Record<TransactionStatus, Set<TransactionStatus>> = {
  [TransactionStatus.PENDING]: new Set([
    TransactionStatus.PROCESSING,
    TransactionStatus.CANCELLED,
  ]),
  [TransactionStatus.PROCESSING]: new Set([
    TransactionStatus.COMPLETED,
    TransactionStatus.FAILED,
  ]),
  [TransactionStatus.COMPLETED]: new Set(), // Terminal state
  [TransactionStatus.FAILED]: new Set([
    TransactionStatus.PENDING, // Allow retry
  ]),
  [TransactionStatus.CANCELLED]: new Set(), // Terminal state
};

/**
 * Checks if a state transition is valid.
 */
export function isValidTransition(
  from: TransactionStatus,
  to: TransactionStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.has(to) ?? false;
}

/**
 * Returns the set of valid target statuses from a given status.
 */
export function getValidTransitions(
  from: TransactionStatus,
): TransactionStatus[] {
  return Array.from(VALID_TRANSITIONS[from] ?? []);
}
