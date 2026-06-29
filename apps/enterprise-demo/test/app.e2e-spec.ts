import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { DatabaseModule } from '../src/shared/database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { REDIS_CLIENT } from '../src/shared/redis/redis.constants';
import { SqsService } from '../src/shared/sqs/sqs.service';
import { TransactionEntity } from '../src/modules/transaction/domain/entities/transaction.entity';
import { OutboxEvent } from '../src/shared/outbox/outbox-event.entity';
import { NotificationConsumer } from '../src/modules/notification/notification.consumer';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue({
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(1),
        on: jest.fn(),
        quit: jest.fn(),
      })
      .overrideProvider(SqsService)
      .useValue({
        sendMessage: jest.fn().mockResolvedValue({ MessageId: 'mock-id' }),
        receiveMessages: jest.fn().mockResolvedValue([]),
        deleteMessage: jest.fn().mockResolvedValue({}),
      })
      .overrideProvider(NotificationConsumer)
      .useValue({
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer()).get('/health').expect(200);
  });

  afterEach(async () => {
    await app.close();
  });
});
