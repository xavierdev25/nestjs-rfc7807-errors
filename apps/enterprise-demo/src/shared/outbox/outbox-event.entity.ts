import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum OutboxEventStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

@Entity('outbox_events')
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  aggregateId: string;

  @Column({ type: 'varchar', length: 255 })
  aggregateType: string;

  @Column({ type: 'varchar', length: 255 })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({
    type: 'enum',
    enum: OutboxEventStatus,
    default: OutboxEventStatus.PENDING,
  })
  status: OutboxEventStatus;

  /**
   * Number of failed publish attempts. The relay keeps an event PENDING and
   * retries it until this reaches MAX_ATTEMPTS, only then giving up (FAILED).
   */
  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  errorReason: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  publishedAt: Date | null;
}
