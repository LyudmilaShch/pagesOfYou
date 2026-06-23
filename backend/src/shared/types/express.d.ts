import type { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export interface RequestWithUser extends Express.Request {
  user: JwtPayload;
}
