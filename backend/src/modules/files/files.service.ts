import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  /**
   * TODO: Soft-delete uploaded file. Remove from R2 only after order is completed.
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await this.prisma.uploadedFile.findFirst({
      where: { id: fileId, userId, deletedAt: null },
    });

    if (!file) throw new NotFoundException('File not found');

    await this.prisma.uploadedFile.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`File soft-deleted: ${fileId}`);
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

  /** Local disk upload for order photos (MVP without R2). */
  registerLocalUpload(userId: string, file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('File is required.');
    }

    const backendUrl =
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`;

    const normalized = file.path.replace(/\\/g, '/');
    const uploadsIdx = normalized.indexOf('uploads/');
    const publicPath =
      uploadsIdx !== -1 ? normalized.slice(uploadsIdx) : `uploads/order-photos/${file.filename}`;

    const url = `${backendUrl}/${publicPath}`;
    const storedPath = toStoredAssetPath(url) ?? publicPath;

    return this.prisma.uploadedFile.create({
      data: {
        userId,
        storageKey: storedPath,
        url: storedPath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
    }).then((record) => ({
      ...record,
      url: resolveAssetUrl(record.url, backendUrl) ?? record.url,
    }));
  }
}
