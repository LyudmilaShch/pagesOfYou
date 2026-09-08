import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Attempts JWT authentication but never rejects the request — `req.user` is populated when a
 * valid token is present, otherwise left undefined. Used by endpoints reachable by both signed-in
 * users and guests (e.g. the photo gallery, scoped by orderId for the former and guestId for the
 * latter). Pair with `@Public()` so the global JwtAuthGuard doesn't reject unauthenticated guests
 * before this guard even runs.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return user;
  }
}
