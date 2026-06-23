import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Handles file URL resolution after Multer saves the file to disk.
 *
 * Architecture note: this service is intentionally thin — all storage logic
 * is delegated to Multer (diskStorage for MVP).  To switch to Cloudflare R2
 * later, replace the diskStorage config in the controller with an R2 stream
 * and update getImageUrl() to return the R2 public URL.
 */
@Injectable()
export class AdminUploadsService {
  constructor(private readonly config: ConfigService) {}

  getImageUrl(file: Express.Multer.File | undefined): { url: string } {
    if (!file) {
      throw new BadRequestException('Файл не передан.');
    }

    const backendUrl =
      this.config.get<string>('app.backendUrl') ??
      `http://localhost:${process.env.PORT ?? 3000}`;

    // Normalize Windows backslashes and extract the public path starting from "uploads/"
    const normalized = file.path.replace(/\\/g, '/');
    const uploadsIdx = normalized.indexOf('uploads/');
    const publicPath =
      uploadsIdx !== -1 ? normalized.slice(uploadsIdx) : `uploads/${file.filename}`;

    return { url: `${backendUrl}/${publicPath}` };
  }
}
