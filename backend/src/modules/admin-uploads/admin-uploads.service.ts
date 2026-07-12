import { BadRequestException, Injectable } from '@nestjs/common';
import { toStoredAssetPath } from '../../common/utils/asset-url.util';

/**
 * Handles file URL resolution after Multer saves the file to disk.
 */
@Injectable()
export class AdminUploadsService {
  getImageUrl(file: Express.Multer.File | undefined): { url: string } {
    if (!file) {
      throw new BadRequestException('Файл не передан.');
    }

    const normalized = file.path.replace(/\\/g, '/');
    const uploadsIdx = normalized.indexOf('uploads/');
    const publicPath =
      uploadsIdx !== -1 ? normalized.slice(uploadsIdx) : `uploads/${file.filename}`;

    return { url: toStoredAssetPath(`/${publicPath}`) ?? `/${publicPath}` };
  }
}
