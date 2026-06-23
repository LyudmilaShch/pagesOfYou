import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database';

@Injectable()
export class MagazineStylesService {
  private readonly logger = new Logger(MagazineStylesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * TODO: Return active styles, optionally filtered by magazineTypeId.
   */
  async findAll(_magazineTypeId?: string) {
    this.logger.log('findAll — stub');
    return this.prisma.magazineStyle.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * TODO: Admin CRUD — create, update, remove (soft delete).
   */
  async create(_data: unknown) {
    this.logger.log('create — stub');
    throw new Error('Not implemented');
  }

  async update(_id: string, _data: unknown) {
    this.logger.log('update — stub');
    throw new Error('Not implemented');
  }

  async remove(_id: string) {
    this.logger.log('remove — stub');
    throw new Error('Not implemented');
  }
}
