import { TransactionEntity } from '../entities/transaction.entity';

/**
 * Payment processing result.
 */
export interface PaymentResult {
  success: boolean;
  externalId?: string;
  failureReason?: string;
  processedAt: Date;
}

/**
 * Payment Gateway Port (DIP).
 *
 * Defines the contract for interacting with external payment processors.
 * The infrastructure layer provides the concrete adapter implementation.
 */
export interface PaymentGatewayPort {
  /**
   * Processes a payment for the given transaction.
   */
  processPayment(transaction: TransactionEntity): Promise<PaymentResult>;

  /**
   * Processes a refund for the given transaction.
   */
  refund(transaction: TransactionEntity): Promise<PaymentResult>;
}

/**
 * DI token for the PaymentGatewayPort.
 */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
