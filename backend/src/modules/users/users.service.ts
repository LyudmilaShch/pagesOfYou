import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * TODO: Return current user profile.
   */
  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * TODO: Update user profile (name, email).
   */
  async updateMe(_userId: string, _data: { name?: string; email?: string }) {
    this.logger.log('updateMe — stub');
    throw new Error('Not implemented');
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
