import { RlsInterceptor } from '../rls.interceptor';
import { RequestContext } from '../../../context/request-context';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('RlsInterceptor', () => {
  let interceptor: RlsInterceptor;
  let mockDataSource: any;

  beforeEach(() => {
    mockDataSource = {};
    interceptor = new RlsInterceptor(mockDataSource);
  });

  function createMockContext(): ExecutionContext {
    return {} as ExecutionContext;
  }

  function createMockCallHandler(): CallHandler {
    return {
      handle: () => of({ result: 'ok' }),
    };
  }

  it('should pass through to the next handler', (done) => {
    const ctx = new RequestContext();
    ctx.tenantId = 'tenant-1';
    ctx.userId = 'user-1';

    RequestContext.run(ctx, () => {
      const result = interceptor.intercept(
        createMockContext(),
        createMockCallHandler(),
      );

      result.subscribe({
        next: (value) => {
          expect(value).toEqual({ result: 'ok' });
          done();
        },
      });
    });
  });

  it('should work without tenant context (public routes)', (done) => {
    const result = interceptor.intercept(
      createMockContext(),
      createMockCallHandler(),
    );

    result.subscribe({
      next: (value) => {
        expect(value).toEqual({ result: 'ok' });
        done();
      },
    });
  });
});
