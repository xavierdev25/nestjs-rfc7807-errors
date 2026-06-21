import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

/**
 * Factory function for JWT module configuration.
 * Reads secret and expiration from environment variables.
 */
export const jwtConfig = (configService: ConfigService): JwtModuleOptions => ({
  secret: configService.get<string>(
    'JWT_SECRET',
    'your-super-secret-jwt-key-change-in-production-2026',
  ),
  signOptions: {
    expiresIn: configService.get<number>('JWT_EXPIRATION', 3600),
    issuer: 'enterprise-demo',
    audience: 'enterprise-api',
  },
});
