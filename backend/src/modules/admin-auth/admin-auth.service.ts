import {
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

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      this.logger.warn(`Failed admin login attempt for ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials.');
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
