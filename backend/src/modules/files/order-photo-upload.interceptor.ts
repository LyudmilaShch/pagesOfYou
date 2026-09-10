import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { FileFilterCallback } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { MAX_IMAGE_UPLOAD_SIZE_BYTES } from '../../shared/constants/upload.constants';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/** Shared multer config for order photo gallery uploads — used by both the customer-facing
 * `/files/image` endpoint and the admin `/admin/orders/:orderId/photos` endpoint, so uploads land
 * in the same local `uploads/order-photos` directory regardless of who's uploading. */
export function orderPhotoUploadInterceptor() {
  return FileInterceptor('file', {
    storage: diskStorage({
      destination: (
        _req,
        _file,
        cb: (error: Error | null, destination: string) => void,
      ) => {
        const dest = join(process.cwd(), 'uploads', 'order-photos');
        if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: MAX_IMAGE_UPLOAD_SIZE_BYTES },
    fileFilter: (_req, file, cb: FileFilterCallback) => {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(new BadRequestException('Unsupported file type'));
        return;
      }
      cb(null, true);
    },
  });
}
