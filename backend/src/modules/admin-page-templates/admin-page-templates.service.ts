import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database';
import { flattenTree } from '../../shared/utils/element-tree.util';
import { normalizeCanvasData } from '../../shared/types/canvas-data.types';
import type {
  CreateQuestionDto,
  ReorderQuestionsDto,
  UpdateQuestionDto,
} from './dto/question.dto';

@Injectable()
export class AdminPageTemplatesService {
  private readonly logger = new Logger(AdminPageTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAllByMagazineType(magazineTypeId: string) {
    await this.assertMagazineTypeExists(magazineTypeId);

    return this.prisma.question.findMany({
      where: { magazineTypeId, deletedAt: null },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(magazineTypeId: string, questionId: string) {
    return this.getQuestionOrThrow(magazineTypeId, questionId);
  }

  async create(magazineTypeId: string, dto: CreateQuestionDto) {
    await this.assertMagazineTypeExists(magazineTypeId);
    await this.assertKeyUnique(magazineTypeId, dto.key);

    const maxSort = await this.prisma.question.aggregate({
      where: { magazineTypeId, deletedAt: null },
      _max: { sortOrder: true },
    });

    const item = await this.prisma.question.create({
      data: {
        magazineTypeId,
        key: dto.key,
        type: dto.type,
        label: dto.label,
        helpText: dto.helpText,
        placeholder: dto.placeholder,
        isRequired: dto.isRequired ?? false,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        validationRules: dto.validationRules as Prisma.InputJsonValue | undefined,
        ...(dto.options && {
          options: {
            createMany: {
              data: dto.options.map((option, index) => ({
                label: option.label,
                value: option.value,
                sortOrder: option.sortOrder ?? index,
              })),
            },
          },
        }),
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });

    this.logger.log(`Question created: ${item.id} (${item.key}) for type ${magazineTypeId}`);
    return item;
  }

  async update(magazineTypeId: string, questionId: string, dto: UpdateQuestionDto) {
    const existing = await this.getQuestionOrThrow(magazineTypeId, questionId);

    if (dto.key !== undefined && dto.key !== existing.key) {
      await this.assertKeyUnique(magazineTypeId, dto.key, questionId);
      await this.assertKeyNotBound(magazineTypeId, existing.key);
    }

    const item = await this.prisma.$transaction(async (tx) => {
      if (dto.options !== undefined) {
        await tx.questionOption.deleteMany({ where: { questionId } });
      }

      return tx.question.update({
        where: { id: questionId },
        data: {
          ...(dto.key !== undefined && { key: dto.key }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.label !== undefined && { label: dto.label }),
          ...(dto.helpText !== undefined && { helpText: dto.helpText }),
          ...(dto.placeholder !== undefined && { placeholder: dto.placeholder }),
          ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
          ...(dto.validationRules !== undefined && {
            validationRules: dto.validationRules as Prisma.InputJsonValue,
          }),
          ...(dto.options !== undefined && {
            options: {
              createMany: {
                data: dto.options.map((option, index) => ({
                  label: option.label,
                  value: option.value,
                  sortOrder: option.sortOrder ?? index,
                })),
              },
            },
          }),
        },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    return item;
  }

  async reorder(magazineTypeId: string, dto: ReorderQuestionsDto) {
    await this.assertMagazineTypeExists(magazineTypeId);

    await this.prisma.$transaction(
      dto.items.map((entry) =>
        this.prisma.question.updateMany({
          where: { id: entry.id, magazineTypeId, deletedAt: null },
          data: { sortOrder: entry.sortOrder },
        }),
      ),
    );

    return this.findAllByMagazineType(magazineTypeId);
  }

  async remove(magazineTypeId: string, questionId: string) {
    await this.getQuestionOrThrow(magazineTypeId, questionId);

    await this.prisma.question.update({
      where: { id: questionId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Question soft-deleted: ${questionId}`);
  }

  private async assertMagazineTypeExists(magazineTypeId: string): Promise<void> {
    const type = await this.prisma.magazineType.findUnique({
      where: { id: magazineTypeId, deletedAt: null },
      select: { id: true },
    });

    if (!type) {
      throw new NotFoundException(`Magazine type "${magazineTypeId}" not found.`);
    }
  }

  private async assertKeyUnique(magazineTypeId: string, key: string, excludeId?: string): Promise<void> {
    // Deliberately not scoped to deletedAt: null — the DB-level @@unique([magazineTypeId, key])
    // constraint has no such scoping either (same precedent as MagazineType.slug), so a
    // soft-deleted question's key stays reserved. Filtering only here would make this check pass
    // while the subsequent insert still fails on the unique index.
    const existing = await this.prisma.question.findFirst({
      where: { magazineTypeId, key, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(`Вопрос с key "${key}" уже существует в этом типе журнала.`);
    }
  }

  /** Rejects a key rename while any canvas element across the magazine type's pages still
   * references the old key — renaming would otherwise silently break that binding. */
  private async assertKeyNotBound(magazineTypeId: string, key: string): Promise<void> {
    const pages = await this.prisma.magazinePage.findMany({
      where: { magazineTypeId, deletedAt: null },
      select: { canvasData: true },
    });

    for (const page of pages) {
      const leaves = flattenTree(normalizeCanvasData(page.canvasData).elements);
      const isBound = leaves.some((leaf) => {
        if (leaf.type === 'ai-text-placeholder') {
          return leaf.questionKeys.includes(key);
        }
        if (leaf.type === 'text-placeholder' || leaf.type === 'title-placeholder' || leaf.type === 'subtitle-placeholder' || leaf.type === 'photo-placeholder') {
          return leaf.questionKey === key;
        }
        return false;
      });

      if (isBound) {
        throw new ConflictException(
          `key "${key}" уже используется элементом шаблона — сначала отвяжите его, чтобы переименовать вопрос.`,
        );
      }
    }
  }

  private async getQuestionOrThrow(magazineTypeId: string, questionId: string) {
    const item = await this.prisma.question.findFirst({
      where: { id: questionId, magazineTypeId, deletedAt: null },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!item) {
      throw new NotFoundException(`Question "${questionId}" not found.`);
    }

    return item;
  }
}
