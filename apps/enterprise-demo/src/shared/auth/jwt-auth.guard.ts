import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { UnauthorizedProblem } from '@xavierdev25/rfc7807-errors';

/**
 * Global JWT Authentication Guard.
 *
 * Applied globally via APP_GUARD. Validates JWT on every request unless
 * the route is decorated with @Public().
 *
 * On authentication failure, throws UnauthorizedProblem (RFC 7807).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Check if the route is marked as @Public() — if so, skip authentication.
   */
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Override to throw RFC 7807-compliant UnauthorizedProblem on auth failure.
   */
  handleRequest<T>(err: Error | null, user: T, info: Error | undefined): T {
    if (err || !user) {
      const detail = info?.message ?? 'Invalid or missing authentication token';
      throw new UnauthorizedProblem({
        detail,
        instance: '/auth/token-validation',
      });
    }
    return user;
  }
}
