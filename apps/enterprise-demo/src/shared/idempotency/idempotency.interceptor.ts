import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { IDEMPOTENT_KEY } from './idempotent.decorator';
import { IdempotencyService } from './idempotency.service';
import { RequestContext } from '../context/request-context';
import {
  BadRequestProblem,
  ConflictProblem,
} from '@xavierdev25/rfc7807-errors';

/**
 * Idempotency Interceptor.
 *
 * Intercepts requests to routes decorated with @Idempotent() and ensures
 * that duplicate requests with the same X-Idempotency-Key return cached
 * responses instead of re-executing the handler.
 *
 * Flow:
 * 1. Check for X-Idempotency-Key header (required for @Idempotent routes)
 * 2. Build scoped key: `tenantId:userId:clientKey`
 * 3. Check Redis for existing response → return cached if found
 * 4. Acquire distributed lock → 409 if already locked (in-progress)
 * 5. Execute handler → cache response → release lock
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    // Check if the route is decorated with @Idempotent()
    const idempotentMeta = this.reflector.get<
      { ttlSeconds: number } | undefined
    >(IDEMPOTENT_KEY, context.getHandler());

    if (!idempotentMeta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Extract the idempotency key from the header
    const clientKey = request.headers['x-idempotency-key'] as
      | string
      | undefined;

    if (!clientKey) {
      throw new BadRequestProblem({
        detail:
          'The X-Idempotency-Key header is required for this endpoint to prevent duplicate operations.',
        instance: request.url,
      });
    }

    const tenantId = RequestContext.currentTenantId() ?? 'anonymous';
    const userId = RequestContext.currentUserId() ?? 'anonymous';
    const scopedKey = this.idempotencyService.buildKey(
      tenantId,
      userId,
      clientKey,
    );

    // 1. Check for cached response
    const cachedResponse =
      await this.idempotencyService.getStoredResponse(scopedKey);
    if (cachedResponse) {
      this.logger.log(`Idempotent cache hit for key: ${scopedKey}`);
      response.setHeader('X-Idempotent-Replayed', 'true');
      response.status(cachedResponse.statusCode);
      return of(cachedResponse.body);
    }

    // 2. Try to acquire the lock
    const lockToken = await this.idempotencyService.acquireLock(scopedKey);
    if (lockToken === null) {
      throw new ConflictProblem({
        detail:
          'A request with this idempotency key is currently being processed. Please retry later.',
        instance: request.url,
        extensions: { idempotencyKey: clientKey },
      });
    }

    // 3. Execute the handler, cache the response, and release the lock.
    //    `mergeMap` (not `map`) is required so the async work is awaited and the
    //    resolved body — not a Promise — is emitted downstream to the client.
    return next.handle().pipe(
      mergeMap((body) =>
        from(
          this.persistAndRelease(
            scopedKey,
            lockToken,
            response,
            body,
            idempotentMeta.ttlSeconds,
          ),
        ),
      ),
      catchError((error) =>
        // Release the lock on error so legitimate retries can proceed.
        from(this.idempotencyService.releaseLock(scopedKey, lockToken)).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
    );
  }

  /**
   * Caches the successful response and releases the owned lock, returning the
   * original body to the client.
   */
  private async persistAndRelease(
    scopedKey: string,
    lockToken: string,
    response: Response,
    body: unknown,
    ttlSeconds: number,
  ): Promise<unknown> {
    const statusCode = response.statusCode;
    await this.idempotencyService.storeResponse(
      scopedKey,
      { statusCode, body },
      ttlSeconds,
    );
    await this.idempotencyService.releaseLock(scopedKey, lockToken);
    return body;
  }
}
