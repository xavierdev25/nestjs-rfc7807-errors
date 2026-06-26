import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { BadRequestProblem } from '@xavierdev25/rfc7807-errors';

/**
 * Baseline security response headers. Implemented inline (rather than pulling in
 * an extra dependency) so the hardening ships with zero added supply-chain
 * surface — consistent with the distroless production posture.
 */
function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.removeHeader('X-Powered-By');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }
  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const logger = new Logger('Bootstrap');

  // Disable the framework fingerprint header and apply baseline security headers.
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(securityHeaders);

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
