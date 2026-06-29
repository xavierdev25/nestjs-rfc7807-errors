import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEvent, OutboxEventStatus } from './outbox-event.entity';
import { SqsService } from '../sqs/sqs.service';

@Injectable()
export class OutboxRelayProcessor {
  private readonly logger = new Logger(OutboxRelayProcessor.name);
  private isProcessing = false;

  /**
   * Maximum publish attempts before an event is considered poisoned and parked
   * in FAILED for manual/operator inspection. Transient broker errors below
   * this threshold leave the event PENDING so the next tick retries it.
   */
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
    private readonly sqsService: SqsService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleCron() {
    if (this.isProcessing) {
      this.logger.debug('Previous execution still running. Skipping...');
      return;
    }

    this.isProcessing = true;
    try {
      await this.processOutboxEvents();
    } catch (error) {
      this.logger.error(
        'Unexpected error during outbox processing',
        error instanceof Error ? error.stack : error,
      );
    } finally {
      this.isProcessing = false;
    }
  }

  private async processOutboxEvents() {
    // Fetch pending events or failed events that can be retried (simple logic: just pick PENDING)
    const pendingEvents = await this.outboxRepository.find({
      where: { status: OutboxEventStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: 50, // Process in batches
    });

    if (pendingEvents.length === 0) {
      return;
    }

    this.logger.debug(
      `Found ${pendingEvents.length} pending events to publish.`,
    );

    for (const event of pendingEvents) {
      try {
        const payloadToPublish = {
          outboxId: event.id,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          eventType: event.eventType,
          payload: event.payload,
          timestamp: event.createdAt,
        };

        await this.sqsService.sendMessage(payloadToPublish);

        // Mark as published
        event.status = OutboxEventStatus.PUBLISHED;
        event.publishedAt = new Date();
        await this.outboxRepository.save(event);
      } catch (error) {
        event.attempts += 1;
        event.errorReason =
          error instanceof Error ? error.message : 'Unknown error';

        if (event.attempts >= this.MAX_ATTEMPTS) {
          // Poisoned message: stop retrying and park it for operator review.
          event.status = OutboxEventStatus.FAILED;
          this.logger.error(
            `Giving up on event ${event.id} after ${event.attempts} attempts`,
            error instanceof Error ? error.stack : error,
          );
        } else {
          // Transient failure: keep it PENDING so the next tick retries it,
          // preserving at-least-once delivery instead of silently dropping it.
          this.logger.warn(
            `Publish attempt ${event.attempts}/${this.MAX_ATTEMPTS} failed for event ${event.id}; will retry.`,
          );
        }

        await this.outboxRepository.save(event);
      }
    }
  }
}
