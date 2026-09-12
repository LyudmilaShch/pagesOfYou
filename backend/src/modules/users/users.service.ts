import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database';
import { resolveAssetUrl, toStoredAssetPath } from '../../common/utils/asset-url.util';

const ME_SELECT = {
  id: true,
  phone: true,
  name: true,
  email: true,
  role: true,
  userNumber: true,
  avatarUrl: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: ME_SELECT,
    });

    if (!user) throw new NotFoundException('User not found');
    return this.withResolvedAvatarUrl(user);
  }

  /** An empty/whitespace-only name clears it back to `null` — the frontend then falls back to
   * displaying "Пользователь #{userNumber}" rather than persisting that fallback text as a real
   * name. `avatarUrl` is expected already-uploaded (via `POST /files/image`) — this just attaches
   * it to the profile, same two-step pattern as `MagazineType.coverImage`. */
  async updateMe(userId: string, data: { name?: string; avatarUrl?: string }) {
    await this.findMe(userId);

    const trimmedName = data.name?.trim();

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: trimmedName || null }),
        ...(data.avatarUrl !== undefined && {
          avatarUrl: toStoredAssetPath(data.avatarUrl),
        }),
      },
      select: ME_SELECT,
    });

    this.logger.log(`User ${userId} updated their profile`);
    return this.withResolvedAvatarUrl(user);
  }

  private backendUrl(): string {
    return (
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`
    );
  }

  private withResolvedAvatarUrl<T extends { avatarUrl: string | null }>(user: T): T {
    return {
      ...user,
      avatarUrl: resolveAssetUrl(user.avatarUrl, this.backendUrl()),
    };
  }

  /**
   * TODO: Soft-delete user account.
   */
  async deleteMe(_userId: string): Promise<void> {
    this.logger.log('deleteMe — stub');
    throw new Error('Not implemented');
  }

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------

  /**
   * TODO: Paginated list of all users (admin only).
   */
  async findAll(_page: number, _limit: number) {
    this.logger.log('findAll — stub');
    throw new Error('Not implemented');
  }
}
