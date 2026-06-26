import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TooManyRequestsProblem } from '@xavierdev25/rfc7807-errors';
import { RateLimitGuard } from '../rate-limit.guard';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { RATE_LIMIT_KEY, SKIP_RATE_LIMIT_KEY } from '../rate-limit.decorator';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;
  let redis: Record<string, jest.Mock>;
  let response: { setHeader: jest.Mock };

  const meta: Record<string, unknown> = {};
  const buildContext = (): ExecutionContext =>
    ({
      getHandler: () => function handler() {},
      getClass: () => class Ctrl {},
      switchToHttp: () => ({
        getRequest: () => ({ url: '/x', ip: '127.0.0.1' }),
        getResponse: () => response,
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: unknown) => meta[key as string]);
    redis = {
      incr: jest.fn(),
      pexpire: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(30_000),
    };
    response = { setHeader: jest.fn() };
    guard = new RateLimitGuard(reflector, redis as never);
    for (const k of Object.keys(meta)) delete meta[k];
  });

  it('skips public routes without touching Redis', async () => {
    meta[IS_PUBLIC_KEY] = true;
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('skips routes marked @SkipRateLimit', async () => {
    meta[SKIP_RATE_LIMIT_KEY] = true;
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('allows under the limit and sets rate-limit headers', async () => {
    meta[RATE_LIMIT_KEY] = { limit: 5, windowMs: 60_000 };
    redis.incr.mockResolvedValue(1);

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(redis.pexpire).toHaveBeenCalledWith(expect.any(String), 60_000);
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Remaining',
      '4',
    );
  });

  it('throws TooManyRequestsProblem with Retry-After when over the limit', async () => {
    meta[RATE_LIMIT_KEY] = { limit: 2, windowMs: 60_000 };
    redis.incr.mockResolvedValue(3);

    await expect(guard.canActivate(buildContext())).rejects.toBeInstanceOf(
      TooManyRequestsProblem,
    );
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '30');
  });

  it('fails OPEN when Redis is unavailable', async () => {
    meta[RATE_LIMIT_KEY] = { limit: 2, windowMs: 60_000 };
    redis.incr.mockRejectedValue(new Error('redis down'));

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });
});
