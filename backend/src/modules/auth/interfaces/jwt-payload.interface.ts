export interface JwtPayload {
  /** userId (Prisma cuid) */
  sub: string;
  /** null for admin accounts */
  phone: string | null;
  role: string;
  /** Standard JWT: issued-at timestamp (added by jsonwebtoken) */
  iat?: number;
  /** Standard JWT: expiration timestamp (added by jsonwebtoken) */
  exp?: number;
}
