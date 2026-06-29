import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { SharedModule } from './shared/shared.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ScheduleModule } from '@nestjs/schedule';
import { Rfc7807Module } from '@xavierdev25/rfc7807-errors';
import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * Root application module.
 *
 * Module import order:
 * 1. ConfigModule — environment variables (must be first, global)
 * 2. Rfc7807Module — global exception filter (RFC 7807)
 * 3. SharedModule — cross-cutting: context, redis, auth, database, idempotency
 * 4. Feature modules — business logic
 */
@Module({
  imports: [
    ConfigModule,
    Rfc7807Module.forRoot({
      includeStackTrace: process.env.NODE_ENV !== 'production',
    }),
    SharedModule,
    TransactionModule,
    NotificationModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
