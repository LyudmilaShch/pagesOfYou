import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JournalSpreadLayout, MagazinePage, PageType } from '@prisma/client';
import { PrismaService } from '../../database';
import { resolveAssetUrl } from '../../common/utils/asset-url.util';
import { MIN_JOURNAL_SPREADS } from '../../shared/constants/journal.constants';
import {
  pickDefaultSpreadTemplate,
  groupTemplatesByPageType,
  type DefaultSpreadTemplate,
} from '../../shared/utils/journal-structure.util';
import { AdminMagazinePagesService } from './admin-magazine-pages.service';
import type {
  DuplicateDefaultSpreadDto,
  SetMagazineDefaultSpreadsDto,
} from './dto/default-spreads.dto';
import { ConfigService } from '@nestjs/config';

const PAGE_SUMMARY = {
  id: true,
  name: true,
  pageType: true,
  previewImage: true,
} as const;

const DEFAULT_SPREAD_INCLUDE = {
  magazinePage: { select: PAGE_SUMMARY },
  rightMagazinePage: { select: PAGE_SUMMARY },
} as const;

@Injectable()
export class AdminMagazineDefaultSpreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly pagesService: AdminMagazinePagesService,
  ) {}

  async findByMagazineTypeId(magazineTypeId: string) {
    await this.ensureMagazineTypeExists(magazineTypeId);

    const spreads = await this.prisma.magazineDefaultSpread.findMany({
      where: { magazineTypeId },
      orderBy: { sortOrder: 'asc' },
      include: DEFAULT_SPREAD_INCLUDE,
    });

    return spreads.map((spread) => this.withResolvedPreview(spread));
  }

  async replaceForMagazineType(
    magazineTypeId: string,
    dto: SetMagazineDefaultSpreadsDto,
  ) {
    await this.ensureMagazineTypeExists(magazineTypeId);

    const templatePages = await this.prisma.magazinePage.findMany({
      where: { magazineTypeId, deletedAt: null },
    });

    const templateMap = new Map(templatePages.map((page) => [page.id, page]));

    for (const [index, item] of dto.spreads.entries()) {
      const primary = templateMap.get(item.magazinePageId);
      if (!primary) {
        throw new NotFoundException(`Template page "${item.magazinePageId}" not found.`);
      }

      if (item.layoutMode === JournalSpreadLayout.SPREAD) {
        if (primary.pageType !== PageType.SPREAD) {
          throw new BadRequestException(
            `Spread #${index + 1}: SPREAD layout requires a SPREAD template.`,
          );
        }
        continue;
      }

      if (primary.pageType !== PageType.PAGE) {
        throw new BadRequestException(
          `Spread #${index + 1}: split layout requires PAGE templates.`,
        );
      }

      if (!item.rightMagazinePageId) {
        throw new BadRequestException(
          `Spread #${index + 1}: right page template is required for split layout.`,
        );
      }

      const right = templateMap.get(item.rightMagazinePageId);
      if (!right || right.pageType !== PageType.PAGE) {
        throw new BadRequestException(
          `Spread #${index + 1}: right PAGE template not found.`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.magazineDefaultSpread.deleteMany({ where: { magazineTypeId } });

      await tx.magazineDefaultSpread.createMany({
        data: dto.spreads.map((item, sortOrder) => ({
          magazineTypeId,
          sortOrder,
          layoutMode: item.layoutMode,
          magazinePageId: item.magazinePageId,
          rightMagazinePageId:
            item.layoutMode === JournalSpreadLayout.SPLIT_PAGES
              ? (item.rightMagazinePageId ?? null)
              : null,
        })),
      });
    });

    return this.findByMagazineTypeId(magazineTypeId);
  }

  async duplicateToType(magazineTypeId: string, dto: DuplicateDefaultSpreadDto) {
    await this.ensureMagazineTypeExists(magazineTypeId);

    if (dto.targetMagazineTypeId === magazineTypeId) {
      throw new BadRequestException('Выберите другой тип журнала для дублирования.');
    }
    await this.ensureMagazineTypeExists(dto.targetMagazineTypeId);

    const primary = await this.prisma.magazinePage.findFirst({
      where: { id: dto.magazinePageId, magazineTypeId, deletedAt: null },
    });
    if (!primary) {
      throw new NotFoundException(`Template page "${dto.magazinePageId}" not found.`);
    }

    let right: MagazinePage | null = null;

    if (dto.layoutMode === JournalSpreadLayout.SPREAD) {
      if (primary.pageType !== PageType.SPREAD) {
        throw new BadRequestException('SPREAD layout requires a SPREAD template.');
      }
    } else {
      if (primary.pageType !== PageType.PAGE) {
        throw new BadRequestException('Split layout requires PAGE templates.');
      }
      if (!dto.rightMagazinePageId) {
        throw new BadRequestException('Right page template is required for split layout.');
      }
      right = await this.prisma.magazinePage.findFirst({
        where: { id: dto.rightMagazinePageId, magazineTypeId, deletedAt: null },
      });
      if (!right || right.pageType !== PageType.PAGE) {
        throw new BadRequestException('Right PAGE template not found.');
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const newPrimary = await this.pagesService.cloneForType(
        primary,
        dto.targetMagazineTypeId,
        tx,
      );
      const newRight = right
        ? await this.pagesService.cloneForType(right, dto.targetMagazineTypeId, tx)
        : null;

      const maxSort = await tx.magazineDefaultSpread.aggregate({
        where: { magazineTypeId: dto.targetMagazineTypeId },
        _max: { sortOrder: true },
      });

      return tx.magazineDefaultSpread.create({
        data: {
          magazineTypeId: dto.targetMagazineTypeId,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
          layoutMode: dto.layoutMode,
          magazinePageId: newPrimary.id,
          rightMagazinePageId: newRight?.id ?? null,
        },
        include: DEFAULT_SPREAD_INCLUDE,
      });
    });

    return this.withResolvedPreview(created);
  }

  async ensureDefaultsForMagazineType(magazineTypeId: string) {
    const existing = await this.prisma.magazineDefaultSpread.count({
      where: { magazineTypeId },
    });

    if (existing >= MIN_JOURNAL_SPREADS) {
      return this.findByMagazineTypeId(magazineTypeId);
    }

    const templatePages = await this.prisma.magazinePage.findMany({
      where: { magazineTypeId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });

    const spreadDefault = pickDefaultSpreadTemplate(groupTemplatesByPageType(templatePages));
    if (!spreadDefault) {
      return [];
    }

    const items: DefaultSpreadTemplate[] = Array.from({ length: MIN_JOURNAL_SPREADS }, () => ({
      ...spreadDefault,
    }));

    return this.replaceForMagazineType(magazineTypeId, {
      spreads: items.map((item) => ({
        layoutMode: item.layoutMode,
        magazinePageId: item.magazinePageId,
        rightMagazinePageId: item.rightMagazinePageId ?? undefined,
      })),
    });
  }

  private async ensureMagazineTypeExists(magazineTypeId: string): Promise<void> {
    const type = await this.prisma.magazineType.findFirst({
      where: { id: magazineTypeId, deletedAt: null },
      select: { id: true },
    });

    if (!type) {
      throw new NotFoundException('Magazine type not found.');
    }
  }

  private backendUrl(): string {
    return (
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`
    );
  }

  private withResolvedPreview<T extends {
    magazinePage: { previewImage: string | null };
    rightMagazinePage?: { previewImage: string | null } | null;
  }>(item: T): T {
    const base = this.backendUrl();

    return {
      ...item,
      magazinePage: {
        ...item.magazinePage,
        previewImage: resolveAssetUrl(item.magazinePage.previewImage, base),
      },
      rightMagazinePage: item.rightMagazinePage
        ? {
            ...item.rightMagazinePage,
            previewImage: resolveAssetUrl(item.rightMagazinePage.previewImage, base),
          }
        : item.rightMagazinePage,
    };
  }
}
