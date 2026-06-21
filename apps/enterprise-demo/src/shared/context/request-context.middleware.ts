import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContext } from './request-context';

/**
 * Middleware that initializes a new RequestContext for each incoming request.
 *
 * Extracts the correlation ID from the `X-Correlation-ID` header (or generates one),
 * and wraps the entire request lifecycle in an AsyncLocalStorage scope.
 *
 * User/tenant data is populated later by the JWT AuthGuard after token validation.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || undefined;

    const context = new RequestContext(correlationId);

    // Set correlation ID on response header for traceability
    _res.setHeader('X-Correlation-ID', context.correlationId);
    _res.setHeader('X-Request-ID', context.requestId);

    RequestContext.run(context, () => {
      next();
    });
  }
}
