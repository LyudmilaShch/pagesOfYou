import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { R2StorageProvider } from '../files/providers/r2-storage.provider';

/**
 * Uploads admin-provided images (magazine type covers, page previews,
 * photo frames…) straight to R2 — the backend's own disk is ephemeral in
 * production and must not be relied on for persistence.
 */
@Injectable()
export class AdminUploadsService {
  constructor(private readonly storage: R2StorageProvider) {}

  async uploadImage(file: Express.Multer.File | undefined): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('Файл не передан.');
    }

    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    const key = `magazine-types/${randomUUID()}${ext}`;
    const url = await this.storage.uploadBuffer(key, file.buffer, file.mimetype);

    return { url };
  }
}
