import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database';

@Injectable()
export class CatalogCustomPhotoMasksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.customPhotoMask.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
