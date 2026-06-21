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
        this.logger.error(
          `Failed to publish event ${event.id}`,
          error instanceof Error ? error.stack : error,
        );

        // Mark as failed so we don't infinitely retry or we could leave it as pending to retry later.
        // For a robust system, you'd add retry counts. Here we mark as FAILED with error reason.
        event.status = OutboxEventStatus.FAILED;
        event.errorReason =
          error instanceof Error ? error.message : 'Unknown error';
        await this.outboxRepository.save(event);
      }
    }
  }
}
