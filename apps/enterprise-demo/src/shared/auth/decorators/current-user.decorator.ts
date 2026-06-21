import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * Parameter decorator to extract the authenticated user from the request.
 *
 * @example
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user;
 * }
 *
 * @Get('my-tenant')
 * getTenant(@CurrentUser('tenantId') tenantId: string) {
 *   return tenantId;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
