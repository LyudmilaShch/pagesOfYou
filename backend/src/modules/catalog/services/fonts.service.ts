import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database';
import { resolveAssetUrl } from '../../../common/utils/asset-url.util';

/** Fields exposed on the public catalog endpoint — omits isActive/deletedAt/timestamps. */
const PUBLIC_SELECT = {
  id: true,
  name: true,
  fontFamily: true,
  regularFileUrl: true,
  boldFileUrl: true,
  italicFileUrl: true,
  boldItalicFileUrl: true,
  sortOrder: true,
} as const;

@Injectable()
export class FontsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Public: active, non-deleted fonts for the editor's font-family picker. */
  async findAll() {
    const items = await this.prisma.font.findMany({
      where: { isActive: true, deletedAt: null },
      select: PUBLIC_SELECT,
      orderBy: { sortOrder: 'asc' },
    });

    return items.map((item) => this.withResolvedFileUrls(item));
  }

  private backendUrl(): string {
    return (
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`
    );
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
