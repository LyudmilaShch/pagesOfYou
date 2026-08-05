import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database';
import { resolveAssetUrl, toStoredAssetPath } from '../../common/utils/asset-url.util';
import type { CreateFontDto, ReorderFontsDto, UpdateFontDto } from './dto/font.dto';

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function transliterate(value: string): string {
  return value
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join('');
}

function slugify(value: string): string {
  const slug = transliterate(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || randomBytes(3).toString('hex');
}

const MAX_FONT_FAMILY_ATTEMPTS = 5;

/**
 * Admin-managed custom fonts. `fontFamily` is generated once at creation
 * (see `buildFontFamily`) and never changes afterwards — it's already baked
 * verbatim into the canvasData of any page/order that used the font, so
 * letting it drift when `name` is renamed would silently break those.
 */
@Injectable()
export class AdminFontsService {
  private readonly logger = new Logger(AdminFontsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll() {
    const items = await this.prisma.font.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });

    return items.map((item) => this.withResolvedFileUrls(item));
  }

  async findOne(id: string) {
    const item = await this.getFontOrThrow(id);
    return this.withResolvedFileUrls(item);
  }

  async create(dto: CreateFontDto) {
    const maxSort = await this.prisma.font.aggregate({
      where: { deletedAt: null },
      _max: { sortOrder: true },
    });

    const baseSlug = slugify(dto.name);
    let fontFamily = `custom-${baseSlug}`;

    for (let attempt = 0; attempt < MAX_FONT_FAMILY_ATTEMPTS; attempt += 1) {
      try {
        const item = await this.prisma.font.create({
          data: {
            name: dto.name,
            fontFamily,
            regularFileUrl: toStoredAssetPath(dto.regularFileUrl) ?? dto.regularFileUrl,
            boldFileUrl: this.storeOptionalUrl(dto.boldFileUrl),
            italicFileUrl: this.storeOptionalUrl(dto.italicFileUrl),
            boldItalicFileUrl: this.storeOptionalUrl(dto.boldItalicFileUrl),
            sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
            isActive: dto.isActive ?? true,
          },
        });

        this.logger.log(`Font created: ${item.id} (${fontFamily})`);
        return this.withResolvedFileUrls(item);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          fontFamily = `custom-${baseSlug}-${randomBytes(3).toString('hex')}`;
          continue;
        }

        throw error;
      }
    }

    throw new Error(`Could not generate a unique fontFamily for "${dto.name}".`);
  }

  async update(id: string, dto: UpdateFontDto) {
    await this.getFontOrThrow(id);

    const item = await this.prisma.font.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.regularFileUrl !== undefined && {
          regularFileUrl: toStoredAssetPath(dto.regularFileUrl) ?? dto.regularFileUrl,
        }),
        ...(dto.boldFileUrl !== undefined && { boldFileUrl: this.storeOptionalUrl(dto.boldFileUrl) }),
        ...(dto.italicFileUrl !== undefined && {
          italicFileUrl: this.storeOptionalUrl(dto.italicFileUrl),
        }),
        ...(dto.boldItalicFileUrl !== undefined && {
          boldItalicFileUrl: this.storeOptionalUrl(dto.boldItalicFileUrl),
        }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return this.withResolvedFileUrls(item);
  }

  async reorder(dto: ReorderFontsDto) {
    await this.prisma.$transaction(
      dto.items.map((entry) =>
        this.prisma.font.updateMany({
          where: { id: entry.id, deletedAt: null },
          data: { sortOrder: entry.sortOrder },
        }),
      ),
    );

    return this.findAll();
  }

  async remove(id: string) {
    await this.getFontOrThrow(id);

    await this.prisma.font.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Font soft-deleted: ${id}`);
  }

  private async getFontOrThrow(id: string) {
    const item = await this.prisma.font.findFirst({
      where: { id, deletedAt: null },
    });

    if (!item) {
      throw new NotFoundException(`Font "${id}" not found.`);
    }

    return item;
  }

  private backendUrl(): string {
    return (
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`
    );
  }

  private storeOptionalUrl(url: string | undefined): string | null {
    if (!url) {
      return null;
    }

    return toStoredAssetPath(url) ?? url;
  }

  private withResolvedFileUrls<
    T extends {
      regularFileUrl: string;
      boldFileUrl: string | null;
      italicFileUrl: string | null;
      boldItalicFileUrl: string | null;
    },
  >(item: T): T {
    const resolve = (url: string | null) =>
      url ? (resolveAssetUrl(url, this.backendUrl()) as string) : null;

    return {
      ...item,
      regularFileUrl: resolveAssetUrl(item.regularFileUrl, this.backendUrl()) as string,
      boldFileUrl: resolve(item.boldFileUrl),
      italicFileUrl: resolve(item.italicFileUrl),
      boldItalicFileUrl: resolve(item.boldItalicFileUrl),
    };
  }
}
