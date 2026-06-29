import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

/**
 * Application configuration module.
 * Loads environment variables from .env and makes them globally available.
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
      expandVariables: true,
    }),
  ],
})
export class ConfigModule {}
