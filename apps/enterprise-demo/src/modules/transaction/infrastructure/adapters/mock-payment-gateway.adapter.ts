import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentGatewayPort,
  PaymentResult,
} from '../../domain/ports/payment-gateway.port';
import { TransactionEntity } from '../../domain/entities/transaction.entity';
import { TransactionType } from '../../domain/value-objects/transaction-status.enum';
import { randomUUID } from 'crypto';

/**
 * Mock Payment Gateway Adapter.
 *
 * Simulates payment processing with configurable success rate
 * and artificial delays. Used for development and testing.
 *
 * In production, this would be replaced by a real payment processor
 * adapter (Stripe, PayPal, etc.) bound to the same PaymentGatewayPort.
 */
@Injectable()
export class MockPaymentGatewayAdapter implements PaymentGatewayPort {
  private readonly logger = new Logger(MockPaymentGatewayAdapter.name);

  /** Success rate for payment processing (0.0 - 1.0) */
  private readonly successRate = 0.85;

  /** Simulated processing delay range in milliseconds */
  private readonly minDelayMs = 100;
  private readonly maxDelayMs = 500;

  async processPayment(transaction: TransactionEntity): Promise<PaymentResult> {
    this.logger.log(
      `Processing payment: id=${transaction.id}, amount=${transaction.amountInCents} ${transaction.currency}`,
    );

    // Simulate network delay
    await this.simulateDelay();

    const success = Math.random() < this.successRate;

    if (success) {
      const externalId = `PAY-${randomUUID().substring(0, 8).toUpperCase()}`;
      this.logger.log(
        `Payment successful: id=${transaction.id}, externalId=${externalId}`,
      );
      return {
        success: true,
        externalId,
        processedAt: new Date(),
      };
    }

    const failureReason = this.getRandomFailureReason();
    this.logger.warn(
      `Payment failed: id=${transaction.id}, reason=${failureReason}`,
    );
    return {
      success: false,
      failureReason,
      processedAt: new Date(),
    };
  }

  async refund(transaction: TransactionEntity): Promise<PaymentResult> {
    this.logger.log(
      `Processing refund: id=${transaction.id}, amount=${transaction.amountInCents} ${transaction.currency}`,
    );

    await this.simulateDelay();

    // Refunds have a higher success rate
    const success = Math.random() < 0.95;

    if (success) {
      const externalId = `REF-${randomUUID().substring(0, 8).toUpperCase()}`;
      return {
        success: true,
        externalId,
        processedAt: new Date(),
      };
    }

    return {
      success: false,
      failureReason: 'Refund could not be processed at this time',
      processedAt: new Date(),
    };
  }

  private async simulateDelay(): Promise<void> {
    const delay =
      Math.random() * (this.maxDelayMs - this.minDelayMs) + this.minDelayMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private getRandomFailureReason(): string {
    const reasons = [
      'Card declined by issuer',
      'Insufficient funds on card',
      'Card expired',
      'Payment processor timeout',
      'Risk check failed',
    ];
    return reasons[Math.floor(Math.random() * reasons.length)];
  }
}
