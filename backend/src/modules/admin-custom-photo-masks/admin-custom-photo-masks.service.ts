import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database';
import type {
  CreateCustomPhotoMaskDto,
  ReorderCustomPhotoMasksDto,
  UpdateCustomPhotoMaskDto,
} from './dto/custom-photo-mask.dto';

@Injectable()
export class AdminCustomPhotoMasksService {
  private readonly logger = new Logger(AdminCustomPhotoMasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.customPhotoMask.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.getMaskOrThrow(id);
  }

  async create(dto: CreateCustomPhotoMaskDto) {
    const maxSort = await this.prisma.customPhotoMask.aggregate({
      where: { deletedAt: null },
      _max: { sortOrder: true },
    });

    const item = await this.prisma.customPhotoMask.create({
      data: {
        name: dto.name,
        points: dto.points as unknown as Prisma.InputJsonValue,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(`Custom photo mask created: ${item.id}`);
    return item;
  }

  async update(id: string, dto: UpdateCustomPhotoMaskDto) {
    await this.getMaskOrThrow(id);

    return this.prisma.customPhotoMask.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.points !== undefined && {
          points: dto.points as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async reorder(dto: ReorderCustomPhotoMasksDto) {
    await this.prisma.$transaction(
      dto.items.map((entry) =>
        this.prisma.customPhotoMask.updateMany({
          where: { id: entry.id, deletedAt: null },
          data: { sortOrder: entry.sortOrder },
        }),
      ),
    );

    return this.findAll();
  }

  async remove(id: string) {
    await this.getMaskOrThrow(id);

    await this.prisma.customPhotoMask.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Custom photo mask soft-deleted: ${id}`);
  }

  private async getMaskOrThrow(id: string) {
    const item = await this.prisma.customPhotoMask.findFirst({
      where: { id, deletedAt: null },
    });

    if (!item) {
      throw new NotFoundException(`Custom photo mask "${id}" not found.`);
    }

    return item;
  }
}
