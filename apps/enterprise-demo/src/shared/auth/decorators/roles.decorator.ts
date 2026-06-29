import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key carrying the roles required to access a route.
 */
export const ROLES_KEY = 'roles';

/**
 * Restricts a route to principals holding at least one of the given roles.
 * Enforced by {@link RolesGuard} (which runs after JWT authentication).
 *
 * @example
 * ```typescript
 * @Roles('admin', 'operator')
 * @Patch(':id/process')
 * process() { ... }
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
