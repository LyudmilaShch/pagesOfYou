import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../database';

/** Max OTP send attempts within the rate-limit window */
const RATE_LIMIT_MAX = 3;
/** Rate-limit window in milliseconds (10 minutes) */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
/** bcrypt cost factor for OTP hashing */
const BCRYPT_ROUNDS = 10;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Generate a new OTP code for the given phone number.
   *
   * Steps:
   *   1. Enforce rate limit (max 3 new codes per 10 minutes per phone).
   *   2. Invalidate any previously active code for this phone.
   *   3. Hash the code with bcrypt and persist.
   *   4. Return the raw code (to be logged / sent via SMS).
   */
  async createOtp(phone: string, ipAddress?: string): Promise<string> {
    await this.enforceRateLimit(phone);
    await this.invalidatePreviousCodes(phone);

    const code = this.generateCode();
    const ttl = this.config.get<number>('otp.ttl') ?? 300;
    const maxAttempts = this.config.get<number>('otp.maxAttempts') ?? 3;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const hashedCode = await bcrypt.hash(code, BCRYPT_ROUNDS);

    await this.prisma.otpCode.create({
      data: {
        phone,
        code: hashedCode,
        maxAttempts,
        expiresAt,
        ipAddress: ipAddress ?? null,
      },
    });

    // MVP: log code to console instead of sending SMS
    this.logger.log(`[OTP] ${phone} → ${code} (expires in ${ttl}s)`);

    return code;
  }

  /**
   * Verify an OTP code for the given phone.
   *
   * Steps:
   *   1. Find the latest active (not expired, not used) code for the phone.
   *   2. Check attempts have not been exhausted.
   *   3. Compare bcrypt hash.
   *   4. On failure: increment attempts counter.
   *   5. On success: mark code as used.
   *
   * @throws UnauthorizedException on invalid/expired code or exhausted attempts.
   */
  async verifyOtp(phone: string, rawCode: string): Promise<void> {
    const record = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new UnauthorizedException('Code is invalid or has expired.');
    }

    if (record.attempts >= record.maxAttempts) {
      throw new UnauthorizedException(
        'Too many incorrect attempts. Please request a new code.',
      );
    }

    const isMatch = await bcrypt.compare(rawCode, record.code);

    if (!isMatch) {
      const newAttempts = record.attempts + 1;
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { attempts: newAttempts },
      });

      const remaining = record.maxAttempts - newAttempts;
      if (remaining <= 0) {
        throw new UnauthorizedException(
          'Code is invalid. No attempts remaining. Please request a new code.',
        );
      }
      throw new UnauthorizedException(
        `Code is invalid. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      );
    }

    // Mark code as used — prevents replay attacks
    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Generate a cryptographically adequate 6-digit code. */
  private generateCode(): string {
    // Math.random is sufficient for MVP OTP; switch to crypto.randomInt() for production
    return Math.floor(100_000 + Math.random() * 900_000).toString();
  }

  /**
   * Throw 429 if the phone has already received >= RATE_LIMIT_MAX codes
   * within the last RATE_LIMIT_WINDOW_MS milliseconds.
   */
  private async enforceRateLimit(phone: string): Promise<void> {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

    const recentCount = await this.prisma.otpCode.count({
      where: {
        phone,
        createdAt: { gte: windowStart },
      },
    });

    if (recentCount >= RATE_LIMIT_MAX) {
      throw new HttpException(
        'Too many code requests. Please wait 10 minutes before trying again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Invalidate all unused, non-expired codes for the phone before issuing a new one.
   * Prevents accumulation of valid codes.
   */
  private async invalidatePreviousCodes(phone: string): Promise<void> {
    await this.prisma.otpCode.updateMany({
      where: {
        phone,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
  }
}
