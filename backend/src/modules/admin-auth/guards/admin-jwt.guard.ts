import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protects routes that require a valid admin JWT.
 * Uses the 'admin-jwt' Passport strategy (separate from the user 'jwt' strategy).
 */
@Injectable()
export class AdminJwtGuard extends AuthGuard('admin-jwt') {}
