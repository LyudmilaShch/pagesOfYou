import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database';

@Injectable()
export class SpreadDesignsService {
  private readonly logger = new Logger(SpreadDesignsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * TODO: Return design variants for a specific template + style combination.
   * Used in step 2 of the order wizard.
   */
  async findByTemplateAndStyle(_spreadTemplateId: string, _styleId: string) {
    this.logger.log('findByTemplateAndStyle — stub');
    throw new Error('Not implemented');
  }

  /**
   * TODO: Return spread design with all field definitions and options.
   * Used in step 3 form builder.
   */
  async findByIdWithFields(_id: string) {
    this.logger.log('findByIdWithFields — stub');
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
