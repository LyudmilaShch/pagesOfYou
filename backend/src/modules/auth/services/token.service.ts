import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../database';
import type { AuthTokens } from '../interfaces/auth-tokens.interface';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

/** bcrypt cost factor for hashing refresh tokens */
const BCRYPT_ROUNDS = 10;

export interface UserForToken {
  id: string;
  /** null for admin accounts that authenticate via email/password */
  phone: string | null;
  role: string;
}


@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Issue a new access + refresh token pair for the given user.
   * The refresh token hash is stored in the User record.
   */
  async generateTokens(user: UserForToken): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };

    const accessToken = this.signAccess(payload);
    const refreshToken = this.signRefresh(payload);

    await this.persistRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessExpiresInSeconds(),
    };
  }

  /**
   * Rotate the refresh token:
   *   1. Validate the incoming token against the stored hash.
   *   2. Issue a new pair and overwrite the stored hash.
   *
   * This implements refresh token rotation — each token is single-use.
   */
  async rotateTokens(
    userId: string,
    incomingRefreshToken: string,
  ): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        phone: true,
        role: true,
        isBlocked: true,
        refreshTokenHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('Account is blocked.');
    }

    if (!user.refreshTokenHash) {
      throw new UnauthorizedException('No active session. Please log in again.');
    }

    const isValid = await bcrypt.compare(incomingRefreshToken, user.refreshTokenHash);
    if (!isValid) {
      // Token reuse detected — clear the hash (security measure)
      await this.revokeRefreshToken(userId);
      this.logger.warn(`Refresh token reuse detected for user ${userId}. Session revoked.`);
      throw new UnauthorizedException(
        'Invalid refresh token. Please log in again.',
      );
    }

    return this.generateTokens(user);
  }

  /**
   * Revoke the stored refresh token (logout / security event).
   */
  async revokeRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    this.logger.log(`Refresh token revoked for user ${userId}.`);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private signAccess(payload: JwtPayload): string {
    const expiresIn = (this.config.get<string>('jwt.accessExpiresIn') ??
      '15m') as JwtSignOptions['expiresIn'];

    return this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn,
    });
  }

  private signRefresh(payload: JwtPayload): string {
    const expiresIn = (this.config.get<string>('jwt.refreshExpiresIn') ??
      '30d') as JwtSignOptions['expiresIn'];

    return this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn,
    });
  }

  private async persistRefreshToken(userId: string, token: string): Promise<void> {
    const hash = await bcrypt.hash(token, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }

  private accessExpiresInSeconds(): number {
    const raw = this.config.get<string>('jwt.accessExpiresIn') ?? '15m';
    // Parse simple formats: "15m" → 900, "1h" → 3600, "1d" → 86400
    const match = raw.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 60);
  }
}
