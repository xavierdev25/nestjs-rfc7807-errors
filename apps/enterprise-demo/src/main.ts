import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { BadRequestProblem } from '@xavierdev25/rfc7807-errors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const logger = new Logger('Bootstrap');

  // Global validation pipe — transforms class-validator errors into RFC 7807
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const violations = errors.map((error) => ({
          field: error.property,
          constraints: error.constraints
            ? Object.values(error.constraints)
            : [],
          value: error.value,
        }));

        return new BadRequestProblem({
          detail: 'One or more fields failed validation.',
          instance: '/validation',
          extensions: { violations },
        });
      },
    }),
  );

  // Enable CORS for development
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-ID',
      'X-Idempotency-Key',
    ],
    exposedHeaders: [
      'X-Correlation-ID',
      'X-Request-ID',
      'X-Idempotent-Replayed',
    ],
  });

  const port = process.env.APP_PORT ?? process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Enterprise Demo running on http://localhost:${port}`);
  logger.log(`📋 Environment: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap();
