import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MagazinePage, Prisma } from '@prisma/client';
import { PrismaService } from '../../database';
import { resolveAssetUrl, toStoredAssetPath } from '../../common/utils/asset-url.util';
import {
  createCanvasDataForPageType,
  normalizeCanvasData,
} from '../../shared/types/canvas-data.types';
import type {
  CreateMagazinePageDto,
  DuplicateMagazinePageDto,
  ReorderMagazinePagesDto,
  UpdateMagazinePageDto,
} from './dto/magazine-page.dto';

@Injectable()
export class AdminMagazinePagesService {
  private readonly logger = new Logger(AdminMagazinePagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAllByMagazineType(magazineTypeId: string) {
    await this.assertMagazineTypeExists(magazineTypeId);

    const items = await this.prisma.magazinePage.findMany({
      where: { magazineTypeId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });

    return items.map((item) => this.withResolvedPreview(item));
  }

  async findOne(magazineTypeId: string, pageId: string) {
    const item = await this.getPageOrThrow(magazineTypeId, pageId);
    return this.withResolvedPreview(item);
  }

  async create(magazineTypeId: string, dto: CreateMagazinePageDto) {
    await this.assertMagazineTypeExists(magazineTypeId);

    const maxSort = await this.prisma.magazinePage.aggregate({
      where: { magazineTypeId, deletedAt: null },
      _max: { sortOrder: true },
    });

    const item = await this.prisma.magazinePage.create({
      data: {
        magazineTypeId,
        name: dto.name,
        description: dto.description,
        pageType: dto.pageType ?? 'PAGE',
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        previewImage: toStoredAssetPath(dto.previewImage),
        canvasData: normalizeCanvasData(
          dto.canvasData ?? createCanvasDataForPageType(dto.pageType ?? 'PAGE'),
        ) as unknown as Prisma.InputJsonValue,
        isRequired: dto.isRequired ?? false,
      },
    });

    this.logger.log(`Magazine page created: ${item.id} for type ${magazineTypeId}`);
    return this.withResolvedPreview(item);
  }

  async duplicate(
    magazineTypeId: string,
    pageId: string,
    dto: DuplicateMagazinePageDto,
  ) {
    const source = await this.getPageOrThrow(magazineTypeId, pageId);
    const targetMagazineTypeId = dto.targetMagazineTypeId ?? magazineTypeId;

    if (dto.targetMagazineTypeId) {
      await this.assertMagazineTypeExists(targetMagazineTypeId);
    }

    const created = await this.cloneForType(source, targetMagazineTypeId);

    this.logger.log(
      `Magazine page duplicated: ${source.id} -> ${created.id} (type ${targetMagazineTypeId})`,
    );
    return this.withResolvedPreview(created);
  }

  /** Creates a copy of `source` under `targetMagazineTypeId`, appended at the end. */
  async cloneForType(
    source: MagazinePage,
    targetMagazineTypeId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<MagazinePage> {
    const maxSort = await client.magazinePage.aggregate({
      where: { magazineTypeId: targetMagazineTypeId, deletedAt: null },
      _max: { sortOrder: true },
    });

    return client.magazinePage.create({
      data: {
        magazineTypeId: targetMagazineTypeId,
        name: `${source.name} (копия)`,
        description: source.description,
        pageType: source.pageType,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        previewImage: source.previewImage,
        canvasData: normalizeCanvasData(source.canvasData) as unknown as Prisma.InputJsonValue,
        isRequired: source.isRequired,
      },
    });
  }

  async update(
    magazineTypeId: string,
    pageId: string,
    dto: UpdateMagazinePageDto,
  ) {
    await this.getPageOrThrow(magazineTypeId, pageId);

    const item = await this.prisma.magazinePage.update({
      where: { id: pageId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.pageType !== undefined && { pageType: dto.pageType }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.previewImage !== undefined && {
          previewImage: toStoredAssetPath(dto.previewImage),
        }),
        ...(dto.canvasData !== undefined && {
          canvasData: normalizeCanvasData(dto.canvasData) as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
      },
    });

    return this.withResolvedPreview(item);
  }

  async reorder(magazineTypeId: string, dto: ReorderMagazinePagesDto) {
    await this.assertMagazineTypeExists(magazineTypeId);

    await this.prisma.$transaction(
      dto.items.map((entry) =>
        this.prisma.magazinePage.updateMany({
          where: { id: entry.id, magazineTypeId, deletedAt: null },
          data: { sortOrder: entry.sortOrder },
        }),
      ),
    );

    return this.findAllByMagazineType(magazineTypeId);
  }

  async remove(magazineTypeId: string, pageId: string) {
    await this.getPageOrThrow(magazineTypeId, pageId);

    await this.prisma.magazinePage.update({
      where: { id: pageId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Magazine page soft-deleted: ${pageId}`);
  }

  async softDeleteByMagazineType(magazineTypeId: string): Promise<void> {
    await this.prisma.magazinePage.updateMany({
      where: { magazineTypeId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
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

  private async getPageOrThrow(magazineTypeId: string, pageId: string) {
    const item = await this.prisma.magazinePage.findFirst({
      where: { id: pageId, magazineTypeId, deletedAt: null },
    });

    if (!item) {
      throw new NotFoundException(`Magazine page "${pageId}" not found.`);
    }

    return item;
  }

  private backendUrl(): string {
    return (
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`
    );
  }

  private withResolvedPreview<T extends { previewImage: string | null }>(item: T): T {
    return {
      ...item,
      previewImage: resolveAssetUrl(item.previewImage, this.backendUrl()),
    };
  }
}
