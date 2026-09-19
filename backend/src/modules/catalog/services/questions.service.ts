import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database';

const PUBLIC_QUESTION_SELECT = {
  id: true,
  key: true,
  type: true,
  label: true,
  helpText: true,
  placeholder: true,
  isRequired: true,
  sortOrder: true,
  options: {
    select: { id: true, label: true, value: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
  },
} as const;

@Injectable()
export class CatalogQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByMagazineTypeId(magazineTypeId: string) {
    const type = await this.prisma.magazineType.findFirst({
      where: { id: magazineTypeId, isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (!type) {
      throw new NotFoundException('Magazine type not found.');
    }

    return this.prisma.question.findMany({
      where: { magazineTypeId, deletedAt: null },
      select: PUBLIC_QUESTION_SELECT,
      orderBy: { sortOrder: 'asc' },
    });
  }
}
