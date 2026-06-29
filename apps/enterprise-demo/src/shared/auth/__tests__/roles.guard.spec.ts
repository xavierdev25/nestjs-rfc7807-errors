import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenProblem } from '@xavierdev25/rfc7807-errors';
import { RolesGuard } from '../roles.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const context = (user?: { roles?: string[] }): ExecutionContext =>
    ({
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({ url: '/transactions/x/process', user }),
      }),
    }) as unknown as ExecutionContext;

  // Metadata resolver: returns isPublic / requiredRoles per call.
  const withMetadata = (opts: { isPublic?: boolean; roles?: string[] }) => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: unknown) => {
        if (key === IS_PUBLIC_KEY) return opts.isPublic ?? false;
        if (key === ROLES_KEY) return opts.roles;
        return undefined;
      });
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows public routes regardless of roles', () => {
    withMetadata({ isPublic: true, roles: ['admin'] });
    expect(guard.canActivate(context({ roles: [] }))).toBe(true);
  });

  it('allows routes without @Roles (authentication is enough)', () => {
    withMetadata({ roles: undefined });
    expect(guard.canActivate(context({ roles: ['user'] }))).toBe(true);
  });

  it('allows when the user holds one of the required roles', () => {
    withMetadata({ roles: ['admin', 'operator'] });
    expect(guard.canActivate(context({ roles: ['operator'] }))).toBe(true);
  });

  it('throws ForbiddenProblem when the user lacks all required roles', () => {
    withMetadata({ roles: ['admin'] });
    expect(() => guard.canActivate(context({ roles: ['user'] }))).toThrow(
      ForbiddenProblem,
    );
  });

  it('throws ForbiddenProblem when there is no authenticated user', () => {
    withMetadata({ roles: ['admin'] });
    expect(() => guard.canActivate(context(undefined))).toThrow(
      ForbiddenProblem,
    );
  });
});
