import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { UnauthorizedProblem } from '@xavierdev25/rfc7807-errors';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new JwtAuthGuard(reflector);
  });

  function createMockContext(): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
        getResponse: jest.fn().mockReturnValue({}),
      }),
      getType: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    };
  }

  describe('canActivate', () => {
    it('should return true for @Public() routes', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockContext();

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should delegate to super.canActivate for non-public routes', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockContext();

      // Spy on the parent class method
      const superCanActivateSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(superCanActivateSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('handleRequest', () => {
    it('should return user when authentication succeeds', () => {
      const user = {
        userId: 'u1',
        tenantId: 't1',
        email: 'a@b.com',
        roles: [],
      };
      const result = guard.handleRequest(null, user, undefined);
      expect(result).toBe(user);
    });

    it('should throw UnauthorizedProblem when user is null', () => {
      expect(() => guard.handleRequest(null, null, undefined)).toThrow(
        UnauthorizedProblem,
      );
    });

    it('should throw UnauthorizedProblem with info message', () => {
      const info = new Error('jwt expired');
      try {
        guard.handleRequest(null, null, info);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedProblem);
        expect((error as Error).message).toContain('jwt expired');
      }
    });

    it('should throw UnauthorizedProblem when error is present', () => {
      const err = new Error('Token malformed');
      expect(() => guard.handleRequest(err, null, undefined)).toThrow(
        UnauthorizedProblem,
      );
    });

    it('should include default message when info is absent', () => {
      try {
        guard.handleRequest(null, null, undefined);
        fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain(
          'Invalid or missing authentication token',
        );
      }
    });
  });
});
