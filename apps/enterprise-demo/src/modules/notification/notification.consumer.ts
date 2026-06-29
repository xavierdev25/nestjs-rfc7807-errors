import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient } from '@aws-sdk/client-sqs';
import { Consumer } from 'sqs-consumer';

@Injectable()
export class NotificationConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationConsumer.name);
  private consumer: Consumer;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const endpoint = this.configService.get<string>(
      'AWS_ENDPOINT_URL',
      'http://localhost:4566',
    );
    const queueUrl = this.configService.get<string>(
      'SQS_QUEUE_URL',
      `${endpoint}/000000000000/domain-events`,
    );

    this.consumer = Consumer.create({
      queueUrl,
      handleMessage: async (message) => {
        try {
          if (!message.Body) return undefined;
          const payload = JSON.parse(message.Body);
          this.logger.log(
            `Received event: ${payload.eventType} for aggregate ${payload.aggregateId}`,
          );

          // Here you would handle the event (e.g. send email/notification)
          await this.processNotification(payload);
          return undefined;
        } catch (error) {
          this.logger.error(
            'Error processing SQS message',
            error instanceof Error ? error.stack : error,
          );
          throw error; // Throwing error prevents message deletion (will retry or go to DLQ)
        }
      },
      sqs: new SQSClient({
        region,
        endpoint,
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test',
        },
      }),
    });

    this.consumer.on('error', (err) => {
      this.logger.error('SQS Consumer Error', err.message);
    });

    this.consumer.on('processing_error', (err) => {
      this.logger.error('SQS Processing Error', err.message);
    });

    this.consumer.start();
    this.logger.log(`Notification Consumer started for queue: ${queueUrl}`);
  }

  onModuleDestroy() {
    if (this.consumer) {
      this.consumer.stop();
      this.logger.log('Notification Consumer stopped');
    }
  }

  private async processNotification(payload: any): Promise<void> {
    // Simulate notification logic
    this.logger.log(`Sending notification for ${payload.eventType} event...`);
    // Example: if (payload.eventType === 'TransactionCreatedEvent') { ... }
  }
}
