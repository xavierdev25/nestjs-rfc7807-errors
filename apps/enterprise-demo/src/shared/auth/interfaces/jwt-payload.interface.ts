/**
 * JWT token payload structure.
 * Extracted from the validated JWT and used to populate the request context.
 */
export interface JwtPayload {
  /** Subject — the user's unique identifier (UUID) */
  sub: string;

  /** Tenant identifier for multi-tenant isolation */
  tenantId: string;

  /** User's email address */
  email: string;

  /** User's assigned roles */
  roles: string[];

  /** Token issued-at timestamp (epoch seconds) */
  iat?: number;

  /** Token expiration timestamp (epoch seconds) */
  exp?: number;

  /** Token issuer */
  iss?: string;
}

/**
 * Authenticated user object attached to the request after JWT validation.
 */
export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
}
