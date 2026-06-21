import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  TransactionStatus,
  TransactionType,
  isValidTransition,
} from '../value-objects/transaction-status.enum';
import { InvalidStatusTransitionError } from '../errors/invalid-status-transition.error';

/**
 * Transaction Domain Entity.
 *
 * Represents a financial transaction (payment, refund, or reservation).
 * Contains domain logic for state machine transitions.
 *
 * TypeORM decorators are used for persistence mapping but the domain
 * logic remains framework-agnostic.
 */
@Entity('transactions')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'userId'])
export class TransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status!: TransactionStatus;

  @Column({ type: 'integer', name: 'amount_in_cents' })
  amountInCents!: number;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true, name: 'external_id' })
  externalId!: string | null;

  @Column({ type: 'text', nullable: true, name: 'failure_reason' })
  failureReason!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // ─── Domain Methods ──────────────────────────────────────────────────

  /**
   * Transitions the transaction to PROCESSING status.
   * @throws InvalidStatusTransitionError if transition is not valid
   */
  markAsProcessing(): void {
    this.transitionTo(TransactionStatus.PROCESSING);
  }

  /**
   * Marks the transaction as successfully completed.
   * @param externalId - The payment processor's reference ID
   * @throws InvalidStatusTransitionError if transition is not valid
   */
  complete(externalId: string): void {
    this.transitionTo(TransactionStatus.COMPLETED);
    this.externalId = externalId;
  }

  /**
   * Marks the transaction as failed.
   * @param reason - The failure reason
   * @throws InvalidStatusTransitionError if transition is not valid
   */
  fail(reason: string): void {
    this.transitionTo(TransactionStatus.FAILED);
    this.failureReason = reason;
  }

  /**
   * Cancels the transaction.
   * @throws InvalidStatusTransitionError if transition is not valid
   */
  cancel(): void {
    this.transitionTo(TransactionStatus.CANCELLED);
  }

  /**
   * Resets a failed transaction back to PENDING for retry.
   * @throws InvalidStatusTransitionError if transition is not valid
   */
  retry(): void {
    this.transitionTo(TransactionStatus.PENDING);
    this.failureReason = null;
  }

  /**
   * Checks if the transaction is in a terminal state (COMPLETED, CANCELLED).
   */
  isTerminal(): boolean {
    return (
      this.status === TransactionStatus.COMPLETED ||
      this.status === TransactionStatus.CANCELLED
    );
  }

  // ─── Private ─────────────────────────────────────────────────────────

  private transitionTo(target: TransactionStatus): void {
    if (!isValidTransition(this.status, target)) {
      throw new InvalidStatusTransitionError(this.id, this.status, target);
    }
    this.status = target;
  }
}
