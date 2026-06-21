import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

@Injectable()
export class SqsService {
  private readonly logger = new Logger(SqsService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const endpoint = this.configService.get<string>(
      'AWS_ENDPOINT_URL',
      'http://localhost:4566',
    );
    this.queueUrl = this.configService.get<string>(
      'SQS_QUEUE_URL',
      `${endpoint}/000000000000/domain-events`,
    );

    this.sqsClient = new SQSClient({
      region,
      endpoint,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });
  }

  async sendMessage(
    payload: Record<string, any>,
    messageGroupId?: string,
  ): Promise<string> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(payload),
      // Optional: If it is a FIFO queue, uncomment below
      // MessageGroupId: messageGroupId,
    });

    try {
      const response = await this.sqsClient.send(command);
      this.logger.debug(
        `Message sent successfully. MessageId: ${response.MessageId}`,
      );
      return response.MessageId as string;
    } catch (error) {
      this.logger.error(
        'Failed to send message to SQS',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  get queueUrlString(): string {
    return this.queueUrl;
  }
}
