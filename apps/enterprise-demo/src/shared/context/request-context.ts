import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

/**
 * Request-scoped context using Node.js AsyncLocalStorage.
 *
 * Provides tenant isolation, user identity, and correlation tracking
 * without polluting method signatures. Safe across async boundaries.
 */
export class RequestContext {
  private static readonly storage = new AsyncLocalStorage<RequestContext>();

  public readonly requestId: string;
  public tenantId: string | null = null;
  public userId: string | null = null;
  public correlationId: string;
  public userEmail: string | null = null;
  public userRoles: string[] = [];

  constructor(correlationId?: string) {
    this.requestId = randomUUID();
    this.correlationId = correlationId ?? randomUUID();
  }

  /**
   * Runs a callback within a new RequestContext scope.
   */
  static run<T>(context: RequestContext, fn: () => T): T {
    return RequestContext.storage.run(context, fn);
  }

  /**
   * Returns the current RequestContext or null if outside a context scope.
   */
  static current(): RequestContext | undefined {
    return RequestContext.storage.getStore();
  }

  /**
   * Returns the current tenant ID or null.
   * @throws {Error} if called outside a request context and strict mode is desired.
   */
  static currentTenantId(): string | null {
    return RequestContext.current()?.tenantId ?? null;
  }

  /**
   * Returns the current user ID or null.
   */
  static currentUserId(): string | null {
    return RequestContext.current()?.userId ?? null;
  }

  /**
   * Returns the current correlation ID or generates a new one.
   */
  static currentCorrelationId(): string {
    return RequestContext.current()?.correlationId ?? randomUUID();
  }

  /**
   * Returns the current request ID.
   */
  static currentRequestId(): string | null {
    return RequestContext.current()?.requestId ?? null;
  }
}
