import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database';
import { OtpService } from './services/otp.service';
import { TokenService } from './services/token.service';
import type { SendCodeDto } from './dto/send-code.dto';
import type { VerifyCodeDto } from './dto/verify-code.dto';
import type { AuthTokens } from './interfaces/auth-tokens.interface';

export interface SendCodeResult {
  message: string;
  /** OTP TTL in seconds — for frontend countdown timer */
  expiresIn: number;
}

export interface VerifyCodeResult extends AuthTokens {
  user: {
    id: string;
    phone: string;
    name: string | null;
    role: string;
    /** true = user was created during this request (first login) */
    isNew: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
  ) {}

  // ---------------------------------------------------------------------------
  // Step 1: Send OTP
  // ---------------------------------------------------------------------------

  /**
   * Generate an OTP for the phone number and log it to the console (MVP).
   * In production: replace the logger.log call with an SMS provider call.
   */
  async sendCode(dto: SendCodeDto, ipAddress?: string): Promise<SendCodeResult> {
    await this.otpService.createOtp(dto.phone, ipAddress);

    const ttl = 300; // keep in sync with OTP_CODE_TTL in .env
    return {
      message: `Verification code sent to ${dto.phone}`,
      expiresIn: ttl,
    };
  }

  // ---------------------------------------------------------------------------
  // Step 2: Verify OTP → issue tokens
  // ---------------------------------------------------------------------------

  /**
   * Verify the OTP, upsert the user, and return JWT token pair.
   *
   * First-time login: User record is created with the phone number.
   * Subsequent logins: existing User record is returned unchanged.
   */
  async verifyCode(dto: VerifyCodeDto): Promise<VerifyCodeResult> {
    // Throws UnauthorizedException on invalid / expired / exhausted code
    await this.otpService.verifyOtp(dto.phone, dto.code);

    const existingUser = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    const isNew = !existingUser;

    // Upsert: create user on first login, do nothing on subsequent logins
    const user = await this.prisma.user.upsert({
      where: { phone: dto.phone },
      update: {},
      create: { phone: dto.phone },
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        isBlocked: true,
        blockedReason: true,
      },
    });

    if (user.isBlocked) {
      throw new ForbiddenException(
        user.blockedReason ?? 'Your account has been blocked.',
      );
    }

    const tokens = await this.tokenService.generateTokens(user);

    this.logger.log(
      `User ${user.id} authenticated (${isNew ? 'new account' : 'existing account'})`,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        // OTP flow always requires a phone number — non-null assertion is safe here
        phone: user.phone!,
        name: user.name,
        role: user.role,
        isNew,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Refresh tokens
  // ---------------------------------------------------------------------------

  /**
   * Rotate the token pair.
   * The old refresh token is validated against the stored hash,
   * then replaced with a new one (single-use refresh tokens).
   */
  async refresh(userId: string, incomingRefreshToken: string): Promise<AuthTokens> {
    return this.tokenService.rotateTokens(userId, incomingRefreshToken);
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  /**
   * Revoke the stored refresh token hash — ends the session.
   */
  async logout(userId: string): Promise<void> {
    await this.tokenService.revokeRefreshToken(userId);
    this.logger.log(`User ${userId} logged out.`);
  }
}
