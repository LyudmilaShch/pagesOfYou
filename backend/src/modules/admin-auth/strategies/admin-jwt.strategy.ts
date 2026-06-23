import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AdminJwtPayload } from '../interfaces/admin-jwt-payload.interface';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('adminJwt.secret');
    if (!secret) throw new Error('JWT_ADMIN_SECRET is not defined');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: AdminJwtPayload): AdminJwtPayload {
    if (!payload?.sub || payload.type !== 'admin' || payload.role !== 'ADMIN') {
      throw new UnauthorizedException('Invalid admin token.');
    }
    return payload;
  }
}
