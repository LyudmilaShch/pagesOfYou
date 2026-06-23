export interface AdminJwtPayload {
  /** userId (Prisma cuid) */
  sub: string;
  email: string;
  role: 'ADMIN';
  /** Marker to distinguish admin tokens from user tokens at the strategy level */
  type: 'admin';
  iat?: number;
  exp?: number;
}
