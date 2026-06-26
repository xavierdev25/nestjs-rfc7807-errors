import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import Redis from 'ioredis';
import { TooManyRequestsProblem } from '@xavierdev25/rfc7807-errors';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { RequestContext } from '../context/request-context';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
  SKIP_RATE_LIMIT_KEY,
} from './rate-limit.decorator';

/**
 * Distributed, Redis-backed rate-limit guard (fixed window).
 *
 * Built on the existing ioredis client (no extra dependency) so the counter is
 * shared across every horizontally-scaled instance — an in-memory throttler
 * would let N replicas serve N× the intended traffic. The window is enforced
 * atomically with INCR + PEXPIRE.
 *
 * Scope: `rl:{route}:{tenantId|ip}:{userId}` — per principal and per route, so a
 * noisy tenant cannot exhaust another's quota. On the limit being exceeded it
 * raises an RFC 7807 `TooManyRequestsProblem` (429) with a `Retry-After` header.
 *
 * Fails OPEN: if Redis is unreachable the request is allowed (availability over
 * strict throttling), and the incident is logged.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  private readonly defaults: RateLimitOptions = {
    limit: Number(process.env.RATE_LIMIT_MAX ?? 100),
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  };

  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    // Health/liveness probes (and other @Public routes) are not throttled so
    // load-balancer checks never trip the limiter.
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) ||
      this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, targets)
    ) {
      return true;
    }

    const options =
      this.reflector.getAllAndOverride<RateLimitOptions>(
        RATE_LIMIT_KEY,
        targets,
      ) ?? this.defaults;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const key = this.buildKey(context, request);

    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.pexpire(key, options.windowMs);
      }

      if (count > options.limit) {
        const ttlMs = await this.redis.pttl(key);
        const retryAfter = Math.max(
          1,
          Math.ceil((ttlMs > 0 ? ttlMs : options.windowMs) / 1000),
        );
        response.setHeader('Retry-After', String(retryAfter));
        throw new TooManyRequestsProblem({
          detail: `Rate limit exceeded: max ${options.limit} requests per ${Math.round(options.windowMs / 1000)}s.`,
          instance: request.url,
          extensions: { limit: options.limit, retryAfterSeconds: retryAfter },
        });
      }

      response.setHeader('X-RateLimit-Limit', String(options.limit));
      response.setHeader(
        'X-RateLimit-Remaining',
        String(Math.max(0, options.limit - count)),
      );
      return true;
    } catch (error) {
      if (error instanceof TooManyRequestsProblem) {
        throw error;
      }
      // Redis failure ⇒ fail open so a cache outage cannot take down the API.
      this.logger.warn(
        `Rate limiter unavailable, allowing request: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return true;
    }
  }

  private buildKey(context: ExecutionContext, request: Request): string {
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const tenantId = RequestContext.currentTenantId() ?? request.ip ?? 'anon';
    const userId = RequestContext.currentUserId() ?? 'anon';
    return `rl:${route}:${tenantId}:${userId}`;
  }
}
