import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ForbiddenProblem } from '@xavierdev25/rfc7807-errors';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { ROLES_KEY } from './decorators/roles.decorator';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface';

/**
 * Role-Based Access Control guard (authorization).
 *
 * Runs globally AFTER {@link JwtAuthGuard} (authentication): by the time this
 * executes, `request.user` is already populated. It enforces the roles declared
 * via `@Roles()` and denies with an RFC 7807 `ForbiddenProblem` (403) — never a
 * bare 403 — keeping the API's error contract uniform.
 *
 * Routes without `@Roles()` (and `@Public()` routes) are allowed through; this
 * guard only adds authorization on top, it does not re-authenticate.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles declared ⇒ authentication alone is sufficient.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    const userRoles = user?.roles ?? [];

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenProblem({
        detail: `This operation requires one of the following roles: [${requiredRoles.join(', ')}].`,
        instance: request.url,
        extensions: { requiredRoles, grantedRoles: userRoles },
      });
    }

    return true;
  }
}
