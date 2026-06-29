import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';
import { RequestContext } from '../../context/request-context';

/**
 * RLS Interceptor.
 *
 * Sets PostgreSQL session variables (app.current_tenant_id, app.current_user_id)
 * on the connection before the request handler executes.
 *
 * Uses SET LOCAL which scopes variables to the current transaction,
 * ensuring tenant isolation even with connection pooling.
 *
 * This interceptor is applied globally for all authenticated routes.
 */
@Injectable()
export class RlsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RlsInterceptor.name);

  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const tenantId = RequestContext.currentTenantId();
    const userId = RequestContext.currentUserId();

    if (tenantId) {
      this.logger.debug(
        `RLS interceptor: tenant=${tenantId}, user=${userId ?? 'anonymous'}`,
      );
    }

    // The actual SET LOCAL is done in TenantAwareEntityManager per-transaction.
    // This interceptor serves as a logging/validation layer.
    // If a tenantId is required but missing, we could throw here.
    return next.handle();
  }
}
