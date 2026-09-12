import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database';
import type { AdminLoginDto } from './dto/admin-login.dto';
import type { AdminJwtPayload } from './interfaces/admin-jwt-payload.interface';

export interface AdminTokenResponse {
  accessToken: string;
  expiresIn: number;
  admin: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
}

/** After this many consecutive failed password attempts, the account is locked out. */
const MAX_FAILED_ATTEMPTS = 5;
/** Lockout duration once MAX_FAILED_ATTEMPTS is reached. */
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: AdminLoginDto): Promise<AdminTokenResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        isBlocked: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (user.role !== 'ADMIN') {
      throw new UnauthorizedException('Admin access required.');
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('Account is blocked.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new ForbiddenException(
        `Too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      );
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      await this.registerFailedAttempt(user.id, user.failedLoginAttempts, dto.email);
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const accessToken = this.signToken({
      sub: user.id,
      email: user.email!,
      role: 'ADMIN',
      type: 'admin',
    });

    this.logger.log(`Admin login: ${dto.email}`);

    return {
      accessToken,
      expiresIn: this.expiresInSeconds(),
      admin: {
        id: user.id,
        email: user.email!,
        name: user.name,
        role: user.role,
      },
    };
  }

  async getMe(adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: adminId, deletedAt: null },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new UnauthorizedException('Admin not found.');
    }

    return user;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async registerFailedAttempt(
    userId: string,
    previousAttempts: number,
    email: string,
  ): Promise<void> {
    const attempts = previousAttempts + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: attempts, lockedUntil },
    });

    if (lockedUntil) {
      this.logger.warn(`Admin account locked after ${attempts} failed attempts: ${email}`);
    } else {
      this.logger.warn(`Failed admin login attempt (${attempts}/${MAX_FAILED_ATTEMPTS}) for ${email}`);
    }
  }

  private signToken(payload: AdminJwtPayload): string {
    const expiresIn = (this.config.get<string>('adminJwt.expiresIn') ??
      '8h') as JwtSignOptions['expiresIn'];

    return this.jwtService.sign(payload, {
      secret: this.config.get<string>('adminJwt.secret'),
      expiresIn,
    });
  }

  private expiresInSeconds(): number {
    const raw = this.config.get<string>('adminJwt.expiresIn') ?? '8h';
    const match = raw.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 28800;
    const value = parseInt(match[1], 10);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[match[2]] ?? 3600);
  }
}
