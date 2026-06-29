import { RequestContext } from '../request-context';

describe('RequestContext (AsyncLocalStorage)', () => {
  it('should create a context with a unique requestId', () => {
    const ctx = new RequestContext();
    expect(ctx.requestId).toBeDefined();
    expect(ctx.requestId.length).toBeGreaterThan(0);
  });

  it('should generate a correlationId if not provided', () => {
    const ctx = new RequestContext();
    expect(ctx.correlationId).toBeDefined();
    expect(ctx.correlationId.length).toBeGreaterThan(0);
  });

  it('should use provided correlationId', () => {
    const ctx = new RequestContext('my-correlation-id');
    expect(ctx.correlationId).toBe('my-correlation-id');
  });

  it('should default tenantId and userId to null', () => {
    const ctx = new RequestContext();
    expect(ctx.tenantId).toBeNull();
    expect(ctx.userId).toBeNull();
  });

  describe('run and current', () => {
    it('should make context available inside run scope', () => {
      const ctx = new RequestContext();
      ctx.tenantId = 'tenant-1';
      ctx.userId = 'user-1';

      RequestContext.run(ctx, () => {
        expect(RequestContext.current()).toBe(ctx);
        expect(RequestContext.currentTenantId()).toBe('tenant-1');
        expect(RequestContext.currentUserId()).toBe('user-1');
      });
    });

    it('should return undefined outside a run scope', () => {
      expect(RequestContext.current()).toBeUndefined();
    });

    it('should return null for tenantId outside scope', () => {
      expect(RequestContext.currentTenantId()).toBeNull();
    });

    it('should return null for userId outside scope', () => {
      expect(RequestContext.currentUserId()).toBeNull();
    });

    it('should isolate contexts across different run scopes', () => {
      const ctx1 = new RequestContext();
      ctx1.tenantId = 'tenant-A';

      const ctx2 = new RequestContext();
      ctx2.tenantId = 'tenant-B';

      RequestContext.run(ctx1, () => {
        expect(RequestContext.currentTenantId()).toBe('tenant-A');
      });

      RequestContext.run(ctx2, () => {
        expect(RequestContext.currentTenantId()).toBe('tenant-B');
      });
    });

    it('should preserve context across async boundaries', async () => {
      const ctx = new RequestContext();
      ctx.tenantId = 'async-tenant';

      await new Promise<void>((resolve) => {
        RequestContext.run(ctx, async () => {
          // Simulate async operation
          await new Promise((r) => setTimeout(r, 10));
          expect(RequestContext.currentTenantId()).toBe('async-tenant');
          resolve();
        });
      });
    });
  });

  describe('static helpers', () => {
    it('should generate a correlationId even outside scope', () => {
      const correlationId = RequestContext.currentCorrelationId();
      expect(correlationId).toBeDefined();
      expect(correlationId.length).toBeGreaterThan(0);
    });

    it('should return null for requestId outside scope', () => {
      expect(RequestContext.currentRequestId()).toBeNull();
    });
  });
});
