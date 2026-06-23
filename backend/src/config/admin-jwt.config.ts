import { registerAs } from '@nestjs/config';

export const adminJwtConfig = registerAs('adminJwt', () => ({
  /** Completely separate secret — never shares space with the user JWT. */
  secret: process.env.JWT_ADMIN_SECRET,
  expiresIn: process.env.JWT_ADMIN_EXPIRES_IN ?? '8h',
}));
