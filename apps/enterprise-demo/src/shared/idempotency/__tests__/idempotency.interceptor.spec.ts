import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import {
  BadRequestProblem,
  ConflictProblem,
} from '@xavierdev25/rfc7807-errors';
import { IdempotencyInterceptor } from '../idempotency.interceptor';
import { IdempotencyService } from '../idempotency.service';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let reflector: jest.Mocked<Pick<Reflector, 'get'>>;
  let service: jest.Mocked<
    Pick<
      IdempotencyService,
      | 'buildKey'
      | 'getStoredResponse'
      | 'acquireLock'
      | 'releaseLock'
      | 'storeResponse'
    >
  >;
  let response: { statusCode: number; setHeader: jest.Mock; status: jest.Mock };

  const buildContext = (
    handlerMeta: { ttlSeconds: number } | undefined,
    headers: Record<string, string> = {},
  ): ExecutionContext => {
    reflector.get.mockReturnValue(handlerMeta);
    const request = { headers, url: '/transactions' };
    return {
      getHandler: () => () => undefined,
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  };

  const callHandler = (
    impl: ReturnType<CallHandler['handle']>,
  ): CallHandler => ({
    handle: () => impl,
  });

  beforeEach(() => {
    reflector = { get: jest.fn() };
    service = {
      buildKey: jest.fn((t, u, k) => `${t}:${u}:${k}`),
      getStoredResponse: jest.fn(),
      acquireLock: jest.fn(),
      releaseLock: jest.fn().mockResolvedValue(true),
      storeResponse: jest.fn().mockResolvedValue(undefined),
    };
    response = {
      statusCode: 201,
      setHeader: jest.fn(),
      status: jest.fn(),
    };

    interceptor = new IdempotencyInterceptor(
      reflector as unknown as Reflector,
      service as unknown as IdempotencyService,
    );
  });

  it('passes through when the route is not @Idempotent', async () => {
    const next = callHandler(of('passthrough'));
    const ctx = buildContext(undefined);

    const result$ = await interceptor.intercept(ctx, next);

    await expect(lastValueFrom(result$)).resolves.toBe('passthrough');
    expect(service.acquireLock).not.toHaveBeenCalled();
  });

  it('throws BadRequestProblem when the X-Idempotency-Key header is missing', async () => {
    const next = callHandler(of('x'));
    const ctx = buildContext({ ttlSeconds: 86400 }, {});

    await expect(interceptor.intercept(ctx, next)).rejects.toBeInstanceOf(
      BadRequestProblem,
    );
  });

  it('replays the cached response on a cache hit without invoking the handler', async () => {
    service.getStoredResponse.mockResolvedValue({
      statusCode: 200,
      body: { id: 'tx-1' },
    });
    const handle = jest.fn(() => of('should-not-run'));
    const ctx = buildContext(
      { ttlSeconds: 86400 },
      {
        'x-idempotency-key': 'k1',
      },
    );

    const result$ = await interceptor.intercept(ctx, { handle });

    await expect(lastValueFrom(result$)).resolves.toEqual({ id: 'tx-1' });
    expect(handle).not.toHaveBeenCalled();
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Idempotent-Replayed',
      'true',
    );
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('throws ConflictProblem when the lock is already held', async () => {
    service.getStoredResponse.mockResolvedValue(null);
    service.acquireLock.mockResolvedValue(null);
    const ctx = buildContext(
      { ttlSeconds: 86400 },
      {
        'x-idempotency-key': 'k1',
      },
    );

    await expect(
      interceptor.intercept(ctx, callHandler(of('x'))),
    ).rejects.toBeInstanceOf(ConflictProblem);
  });

  it('emits the resolved body (not a Promise), caches it, and releases the lock', async () => {
    service.getStoredResponse.mockResolvedValue(null);
    service.acquireLock.mockResolvedValue('token-123');
    const body = { id: 'tx-9', status: 'PENDING' };
    const ctx = buildContext(
      { ttlSeconds: 86400 },
      {
        'x-idempotency-key': 'k1',
      },
    );

    const result$ = await interceptor.intercept(ctx, callHandler(of(body)));
    const emitted = await lastValueFrom(result$);

    // Regression guard: the previous `map(p => p)` emitted an unresolved Promise.
    expect(emitted).not.toBeInstanceOf(Promise);
    expect(emitted).toEqual(body);
    expect(service.storeResponse).toHaveBeenCalledWith(
      'anonymous:anonymous:k1',
      { statusCode: 201, body },
      86400,
    );
    expect(service.releaseLock).toHaveBeenCalledWith(
      'anonymous:anonymous:k1',
      'token-123',
    );
  });

  it('releases the lock and propagates the error when the handler fails', async () => {
    service.getStoredResponse.mockResolvedValue(null);
    service.acquireLock.mockResolvedValue('token-err');
    const boom = new Error('handler failed');
    const ctx = buildContext(
      { ttlSeconds: 86400 },
      {
        'x-idempotency-key': 'k1',
      },
    );

    const result$ = await interceptor.intercept(
      ctx,
      callHandler(throwError(() => boom)),
    );

    await expect(lastValueFrom(result$)).rejects.toBe(boom);
    expect(service.releaseLock).toHaveBeenCalledWith(
      'anonymous:anonymous:k1',
      'token-err',
    );
    expect(service.storeResponse).not.toHaveBeenCalled();
  });
});
