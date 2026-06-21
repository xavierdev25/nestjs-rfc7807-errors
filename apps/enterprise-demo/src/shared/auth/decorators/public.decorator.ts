import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for the @Public() decorator.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark a route as publicly accessible (skips JWT authentication).
 *
 * @example
 * ```typescript
 * @Public()
 * @Get('health')
 * healthCheck() { return { status: 'ok' }; }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
