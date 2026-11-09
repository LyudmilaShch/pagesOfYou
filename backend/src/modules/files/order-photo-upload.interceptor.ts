import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { FileFilterCallback } from 'multer';
import { MAX_IMAGE_UPLOAD_SIZE_BYTES } from '../../shared/constants/upload.constants';
import { orderPhotoUnsupportedMessage } from './photo-upload-error';
import { isAllowedOrderPhoto } from './prepare-order-photo';

/** Shared multer config for order photo gallery uploads — used by both the customer-facing
 * `/files/image` endpoint and the admin `/admin/orders/:orderId/photos` endpoint. Buffers the file
 * in memory (`file.buffer`, not `file.path`) instead of writing to local disk — Render's (and most
 * PaaS) container filesystem is ephemeral and gets wiped on every restart/redeploy, which was
 * silently deleting every previously-uploaded photo the next time the service redeployed. The
 * caller (`FilesService.persistUploadedFile`) uploads that buffer straight to Yandex Object
 * Storage instead. */
export function orderPhotoUploadInterceptor() {
  return FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: MAX_IMAGE_UPLOAD_SIZE_BYTES },
    fileFilter: (_req, file, cb: FileFilterCallback) => {
      if (!isAllowedOrderPhoto(file)) {
        cb(new BadRequestException(orderPhotoUnsupportedMessage(file.originalname)));
        return;
      }
      cb(null, true);
    },
  });
}
