import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from './outbox-event.entity';
import { OutboxService } from './outbox.service';
import { OutboxRelayProcessor } from './outbox-relay.processor';
import { SqsModule } from '../sqs/sqs.module';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent]), SqsModule],
  providers: [OutboxService, OutboxRelayProcessor],
  exports: [OutboxService],
})
export class OutboxModule {}
