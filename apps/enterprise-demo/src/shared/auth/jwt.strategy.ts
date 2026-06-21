import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  AuthenticatedUser,
  JwtPayload,
} from './interfaces/jwt-payload.interface';
import { RequestContext } from '../context/request-context';

/**
 * Passport JWT Strategy.
 *
 * Extracts and validates JWT from the Authorization header.
 * After validation, populates the RequestContext with tenant/user data.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'your-super-secret-jwt-key-change-in-production-2026',
      ),
    });
  }

  /**
   * Called after JWT signature is verified.
   * Maps the payload to an AuthenticatedUser and populates the RequestContext.
   */
  validate(payload: JwtPayload): AuthenticatedUser {
    const user: AuthenticatedUser = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      roles: payload.roles ?? [],
    };

    // Populate the AsyncLocalStorage context with user/tenant data
    const context = RequestContext.current();
    if (context) {
      context.tenantId = user.tenantId;
      context.userId = user.userId;
      context.userEmail = user.email;
      context.userRoles = user.roles;
    }

    return user;
  }
}
