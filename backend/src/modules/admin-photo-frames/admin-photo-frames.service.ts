import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database';
import { resolveAssetUrl, toStoredAssetPath } from '../../common/utils/asset-url.util';
import type {
  CreatePhotoFrameDto,
  ReorderPhotoFramesDto,
  UpdatePhotoFrameDto,
} from './dto/photo-frame.dto';

@Injectable()
export class AdminPhotoFramesService {
  private readonly logger = new Logger(AdminPhotoFramesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll() {
    const items = await this.prisma.photoFrame.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });

    return items.map((item) => this.withResolvedImage(item));
  }

  async findOne(id: string) {
    const item = await this.getFrameOrThrow(id);
    return this.withResolvedImage(item);
  }

  async create(dto: CreatePhotoFrameDto) {
    const maxSort = await this.prisma.photoFrame.aggregate({
      where: { deletedAt: null },
      _max: { sortOrder: true },
    });

    const item = await this.prisma.photoFrame.create({
      data: {
        name: dto.name,
        imageUrl: toStoredAssetPath(dto.imageUrl) ?? dto.imageUrl,
        naturalWidth: dto.naturalWidth,
        naturalHeight: dto.naturalHeight,
        sliceTop: dto.sliceTop,
        sliceRight: dto.sliceRight,
        sliceBottom: dto.sliceBottom,
        sliceLeft: dto.sliceLeft,
        photoAreaTop: dto.photoAreaTop,
        photoAreaRight: dto.photoAreaRight,
        photoAreaBottom: dto.photoAreaBottom,
        photoAreaLeft: dto.photoAreaLeft,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(`Photo frame created: ${item.id}`);
    return this.withResolvedImage(item);
  }

  async update(id: string, dto: UpdatePhotoFrameDto) {
    await this.getFrameOrThrow(id);

    const item = await this.prisma.photoFrame.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.imageUrl !== undefined && {
          imageUrl: toStoredAssetPath(dto.imageUrl) ?? dto.imageUrl,
        }),
        ...(dto.naturalWidth !== undefined && { naturalWidth: dto.naturalWidth }),
        ...(dto.naturalHeight !== undefined && { naturalHeight: dto.naturalHeight }),
        ...(dto.sliceTop !== undefined && { sliceTop: dto.sliceTop }),
        ...(dto.sliceRight !== undefined && { sliceRight: dto.sliceRight }),
        ...(dto.sliceBottom !== undefined && { sliceBottom: dto.sliceBottom }),
        ...(dto.sliceLeft !== undefined && { sliceLeft: dto.sliceLeft }),
        ...(dto.photoAreaTop !== undefined && { photoAreaTop: dto.photoAreaTop }),
        ...(dto.photoAreaRight !== undefined && { photoAreaRight: dto.photoAreaRight }),
        ...(dto.photoAreaBottom !== undefined && { photoAreaBottom: dto.photoAreaBottom }),
        ...(dto.photoAreaLeft !== undefined && { photoAreaLeft: dto.photoAreaLeft }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return this.withResolvedImage(item);
  }

  async reorder(dto: ReorderPhotoFramesDto) {
    await this.prisma.$transaction(
      dto.items.map((entry) =>
        this.prisma.photoFrame.updateMany({
          where: { id: entry.id, deletedAt: null },
          data: { sortOrder: entry.sortOrder },
        }),
      ),
    );

    return this.findAll();
  }

  async remove(id: string) {
    await this.getFrameOrThrow(id);

    await this.prisma.photoFrame.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Photo frame soft-deleted: ${id}`);
  }

  private async getFrameOrThrow(id: string) {
    const item = await this.prisma.photoFrame.findFirst({
      where: { id, deletedAt: null },
    });

    if (!item) {
      throw new NotFoundException(`Photo frame "${id}" not found.`);
    }

    return item;
  }

  private backendUrl(): string {
    return (
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`
    );
  }

  private withResolvedImage<T extends { imageUrl: string }>(item: T): T {
    return {
      ...item,
      imageUrl: resolveAssetUrl(item.imageUrl, this.backendUrl()) as string,
    };
  }
}
