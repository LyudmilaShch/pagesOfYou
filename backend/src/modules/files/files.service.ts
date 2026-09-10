import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database';
import { toStoredAssetPath, resolveAssetUrl } from '../../common/utils/asset-url.util';
import { R2StorageProvider } from './providers/r2-storage.provider';
import {
  MAX_IMAGE_UPLOAD_SIZE_BYTES,
  MAX_IMAGE_UPLOAD_SIZE_MB,
} from '../../shared/constants/upload.constants';

export interface RequestUploadUrlDto {
  /** Original file name — stored for display purposes */
  originalName: string;
  /** MIME type, e.g. "image/jpeg" */
  mimeType: string;
  /** File size in bytes — validated against upload limit */
  size: number;
}

export interface UploadUrlResponse {
  /** Presigned PUT URL — client uploads directly to R2 */
  uploadUrl: string;
  /** Public CDN URL — save after confirming upload */
  publicUrl: string;
  /** Storage key — pass back to confirmUpload() */
  storageKey: string;
}

/** Who a gallery request is acting as — either a signed-in user (identity.userId) or a guest
 * session (a scope.guestId, no auth). Exactly one of scope.orderId/scope.guestId is expected. */
export interface GalleryIdentity {
  userId?: string;
}

export interface GalleryScope {
  orderId?: string;
  guestId?: string;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: R2StorageProvider,
    private readonly config: ConfigService,
  ) {}

  /**
   * Step 1: Generate presigned upload URL for client-side direct upload to R2.
   * Does NOT create a DB record yet.
   */
  async requestUploadUrl(userId: string, dto: RequestUploadUrlDto): Promise<UploadUrlResponse> {
    if (dto.size > MAX_IMAGE_UPLOAD_SIZE_BYTES) {
      throw new Error(`File size exceeds the limit of ${MAX_IMAGE_UPLOAD_SIZE_MB} MB`);
    }

    if (!ALLOWED_MIME_TYPES.includes(dto.mimeType)) {
      throw new Error(`Unsupported file type: ${dto.mimeType}`);
    }

    const ext = dto.mimeType.split('/')[1];
    const storageKey = `uploads/${userId}/${randomUUID()}.${ext}`;

    const result = await this.storage.generateUploadUrl({
      key: storageKey,
      contentType: dto.mimeType,
      expiresIn: 900,
    });

    return {
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
      storageKey,
    };
  }

  /**
   * Step 2: Confirm that the client successfully uploaded the file.
   * Creates the UploadedFile record in the database.
   *
   * TODO: Optionally trigger a worker to generate a preview/thumbnail.
   */
  async confirmUpload(
    userId: string,
    storageKey: string,
    meta: { originalName: string; mimeType: string; size: number },
  ) {
    const url = this.storage.getFileUrl(storageKey);

    const file = await this.prisma.uploadedFile.create({
      data: {
        userId,
        storageKey,
        url,
        originalName: meta.originalName,
        mimeType: meta.mimeType,
        size: meta.size,
      },
    });

    this.logger.log(`File confirmed: ${file.id} for user ${userId}`);
    return file;
  }

  private async assertOwnsOrder(orderId: string, userId: string): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }
  }

  /** Local disk upload — general authenticated uploads (no scope) keep working exactly as
   * before; `scope.orderId`/`scope.guestId` additionally attach the file to an order or guest
   * gallery. */
  async registerLocalUpload(
    file: Express.Multer.File | undefined,
    identity: GalleryIdentity,
    scope: GalleryScope & { width?: number; height?: number },
  ) {
    if (!file) {
      throw new BadRequestException('File is required.');
    }

    let userId: string | null = identity.userId ?? null;
    let orderId: string | null = null;
    let guestId: string | null = null;

    if (scope.orderId) {
      if (!identity.userId) {
        throw new UnauthorizedException('Sign in to upload to an order gallery.');
      }
      await this.assertOwnsOrder(scope.orderId, identity.userId);
      orderId = scope.orderId;
    } else if (scope.guestId) {
      // Guest gallery uploads aren't tied to an account, even if the caller happens to also be
      // signed in — the guest token is what the frontend keeps reading the gallery back by.
      guestId = scope.guestId;
      userId = null;
    } else if (!identity.userId) {
      throw new UnauthorizedException('Sign in to upload files.');
    }

    return this.persistLocalFile(file, {
      userId,
      orderId,
      guestId,
      width: scope.width,
      height: scope.height,
    });
  }

  /** Admin counterpart of `registerLocalUpload` — an admin isn't the order's owner, so it bypasses
   * `assertOwnsOrder` (only requires the order to exist), and attributes the file to the order's
   * own customer so the record looks identical to one the customer uploaded themselves. */
  async registerAdminUpload(
    orderId: string,
    file: Express.Multer.File | undefined,
    dimensions: { width?: number; height?: number },
  ) {
    if (!file) {
      throw new BadRequestException('File is required.');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      select: { userId: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    return this.persistLocalFile(file, {
      userId: order.userId,
      orderId,
      guestId: null,
      width: dimensions.width,
      height: dimensions.height,
    });
  }

  private async persistLocalFile(
    file: Express.Multer.File,
    data: { userId: string | null; orderId: string | null; guestId: string | null; width?: number; height?: number },
  ) {
    const backendUrl =
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`;

    const normalized = file.path.replace(/\\/g, '/');
    const uploadsIdx = normalized.indexOf('uploads/');
    const publicPath =
      uploadsIdx !== -1 ? normalized.slice(uploadsIdx) : `uploads/order-photos/${file.filename}`;

    const url = `${backendUrl}/${publicPath}`;
    const storedPath = toStoredAssetPath(url) ?? publicPath;

    return this.prisma.uploadedFile
      .create({
        data: {
          userId: data.userId,
          orderId: data.orderId,
          guestId: data.guestId,
          storageKey: storedPath,
          url: storedPath,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          width: data.width ?? null,
          height: data.height ?? null,
        },
      })
      .then((record) => ({
        ...record,
        url: resolveAssetUrl(record.url, backendUrl) ?? record.url,
      }));
  }

  /**
   * TODO: Soft-delete uploaded file. Remove from R2 only after order is completed.
   */
  async deleteFile(fileId: string, identity: GalleryIdentity & GalleryScope): Promise<void> {
    await this.getOwnedFileOrThrow(fileId, identity);

    await this.prisma.uploadedFile.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`File soft-deleted: ${fileId}`);
  }

  async setFavorite(
    fileId: string,
    identity: GalleryIdentity & GalleryScope,
    isFavorite: boolean,
  ) {
    const file = await this.getOwnedFileOrThrow(fileId, identity);

    return this.prisma.uploadedFile.update({
      where: { id: file.id },
      data: { isFavorite },
    });
  }

  /** Admin counterpart of `list({ orderId })` — no ownership check, just the order's photos. */
  async listForAdmin(orderId: string) {
    return this.prisma.uploadedFile.findMany({
      where: { orderId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setFavoriteForAdmin(orderId: string, fileId: string, isFavorite: boolean) {
    const file = await this.getOrderScopedFileOrThrow(fileId, orderId);

    return this.prisma.uploadedFile.update({
      where: { id: file.id },
      data: { isFavorite },
    });
  }

  async deleteForAdmin(orderId: string, fileId: string): Promise<void> {
    await this.getOrderScopedFileOrThrow(fileId, orderId);

    await this.prisma.uploadedFile.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`File soft-deleted by admin: ${fileId}`);
  }

  private async getOrderScopedFileOrThrow(fileId: string, orderId: string) {
    const file = await this.prisma.uploadedFile.findFirst({
      where: { id: fileId, orderId, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  /** Re-parents a guest's gallery photos onto a real order once one exists (e.g. at
   * registration/checkout) — not called from anywhere yet (that flow doesn't exist yet), but the
   * file model already supports it, so wiring the endpoint now avoids a second migration later. */
  async claimGuestPhotos(
    guestId: string,
    orderId: string,
    userId: string,
  ): Promise<{ count: number }> {
    await this.assertOwnsOrder(orderId, userId);

    const result = await this.prisma.uploadedFile.updateMany({
      where: { guestId, orderId: null, deletedAt: null },
      data: { guestId: null, orderId, userId },
    });

    this.logger.log(`Claimed ${result.count} guest photo(s) for order ${orderId}`);
    return { count: result.count };
  }

  private async getOwnedFileOrThrow(fileId: string, identity: GalleryIdentity & GalleryScope) {
    const file = await this.prisma.uploadedFile.findFirst({
      where: { id: fileId, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const owns =
      (file.userId != null && identity.userId != null && file.userId === identity.userId) ||
      (file.guestId != null && identity.guestId != null && file.guestId === identity.guestId);

    if (!owns) {
      // 404, not 403 — don't reveal that the id exists to a caller who doesn't own it.
      throw new NotFoundException('File not found');
    }

    return file;
  }

  /**
   * Return files scoped to an order gallery, a guest gallery, or (legacy, no scope) all files
   * uploaded by the current user.
   */
  async list(identity: GalleryIdentity, scope: GalleryScope) {
    if (scope.orderId) {
      if (!identity.userId) {
        throw new UnauthorizedException('Sign in to view this order gallery.');
      }
      await this.assertOwnsOrder(scope.orderId, identity.userId);
      return this.prisma.uploadedFile.findMany({
        where: { orderId: scope.orderId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (scope.guestId) {
      return this.prisma.uploadedFile.findMany({
        where: { guestId: scope.guestId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!identity.userId) {
      throw new UnauthorizedException('Sign in to view your files.');
    }

    return this.findAllByUser(identity.userId);
  }

  /**
   * Return files uploaded by the current user.
   */
  async findAllByUser(userId: string) {
    return this.prisma.uploadedFile.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }
}
