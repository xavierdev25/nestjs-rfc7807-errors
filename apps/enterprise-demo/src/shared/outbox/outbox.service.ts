import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OutboxEvent, OutboxEventStatus } from './outbox-event.entity';

@Injectable()
export class OutboxService {
  /**
   * Saves an event to the outbox table within the provided transactional entity manager.
   * This guarantees that the event is only committed if the parent transaction commits.
   */
  async saveEvent(
    manager: EntityManager,
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    payload: Record<string, any>,
  ): Promise<OutboxEvent> {
    const outboxEvent = manager.create(OutboxEvent, {
      aggregateId,
      aggregateType,
      eventType,
      payload,
      status: OutboxEventStatus.PENDING,
    });

    return manager.save(outboxEvent);
  }
}
