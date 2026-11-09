import { HttpStatus } from '@nestjs/common';
import { MulterError } from 'multer';
import {
  MAX_FONT_UPLOAD_SIZE_MB,
  MAX_IMAGE_UPLOAD_SIZE_MB,
} from '../../shared/constants/upload.constants';

/** Same sentences the upload form shows before the request is sent. */
export function orderPhotoTooLargeMessage(originalName?: string, limitLabel?: string): string {
  const limit = limitLabel ?? `${MAX_IMAGE_UPLOAD_SIZE_MB} МБ`;
  return originalName ? `Файл «${originalName}» больше ${limit}` : `Файл больше ${limit}`;
}

export function orderPhotoUnsupportedMessage(originalName?: string): string {
  return originalName
    ? `Файл «${originalName}»: формат не поддерживается`
    : 'Формат не поддерживается';
}

export function orderPhotoHeicFailedMessage(originalName?: string): string {
  const reason =
    'не удалось прочитать HEIC/HEIF. Сохраните его как JPEG максимального качества и загрузите снова.';
  return originalName
    ? `Файл «${originalName}»: ${reason}`
    : 'Не удалось прочитать HEIC/HEIF. Сохраните его как JPEG максимального качества и загрузите снова.';
}

export function orderPhotoHeicTooLargeMessage(originalName?: string): string {
  const reason = 'фото слишком большое по разрешению. Загрузите JPEG в максимальном качестве.';
  return originalName ? `Файл «${originalName}»: ${reason}` : reason;
}

/**
 * Multer rejects an oversized part before the controller runs, with an English `File too large`
 * and no HTTP status of its own. The filename is on the error (multer 2). Font uploads share this
 * filter and use a smaller cap, so the limit in the sentence follows the route.
 */
export function messageForMulterError(
  exception: unknown,
  url = '',
): { statusCode: number; message: string } | null {
  if (!(exception instanceof MulterError)) {
    return null;
  }

  if (exception.code !== 'LIMIT_FILE_SIZE') {
    return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message };
  }

  const filename = (exception as MulterError & { filename?: string }).filename;
  const limitLabel = url.includes('/uploads/font')
    ? `${MAX_FONT_UPLOAD_SIZE_MB} МБ`
    : `${MAX_IMAGE_UPLOAD_SIZE_MB} МБ`;

  return {
    statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
    message: orderPhotoTooLargeMessage(filename, limitLabel),
  };
}
