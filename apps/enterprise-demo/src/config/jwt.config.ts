import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';
import { DEV_JWT_SECRET, requireSecret } from './secret.util';

/**
 * Factory function for JWT module configuration.
 * Reads secret and expiration from environment variables.
 * JWT_SECRET is mandatory in production (see requireSecret).
 */
export const jwtConfig = (configService: ConfigService): JwtModuleOptions => ({
  secret: requireSecret(
    configService.get<string>('JWT_SECRET'),
    'JWT_SECRET',
    DEV_JWT_SECRET,
  ),
  signOptions: {
    expiresIn: configService.get<number>('JWT_EXPIRATION', 3600),
    issuer: 'enterprise-demo',
    audience: 'enterprise-api',
  },
});
