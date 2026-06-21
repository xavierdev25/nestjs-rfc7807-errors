import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationConsumer } from './notification.consumer';

@Module({
  imports: [ConfigModule],
  providers: [NotificationConsumer],
})
export class NotificationModule {}
