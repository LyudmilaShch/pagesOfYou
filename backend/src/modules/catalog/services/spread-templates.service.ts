import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database';

@Injectable()
export class SpreadTemplatesService {
  private readonly logger = new Logger(SpreadTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * TODO: Return spread templates available for a given magazineTypeId,
   * sorted by MagazineTypeSpread.sortOrder.
   */
  async findByMagazineType(_magazineTypeId: string) {
    this.logger.log('findByMagazineType — stub');
    throw new Error('Not implemented');
  }

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
