import { HttpStatus } from '@nestjs/common';
import { MulterError } from 'multer';
import {
  messageForMulterError,
  orderPhotoHeicFailedMessage,
  orderPhotoTooLargeMessage,
  orderPhotoUnsupportedMessage,
} from './photo-upload-error';

function sizeError(filename?: string): MulterError & { filename?: string } {
  const error = new MulterError('LIMIT_FILE_SIZE', 'file') as MulterError & { filename?: string };
  error.filename = filename;
  return error;
}

describe('order photo rejection messages', () => {
  it('names the file and the reason the way the upload form does', () => {
    expect(orderPhotoTooLargeMessage('vacation.HEIC')).toBe('Файл «vacation.HEIC» больше 20 МБ');
    expect(orderPhotoUnsupportedMessage('notes.pdf')).toBe(
      'Файл «notes.pdf»: формат не поддерживается',
    );
    expect(orderPhotoHeicFailedMessage('IMG_0001.HEIC')).toContain('Файл «IMG_0001.HEIC»');
    expect(orderPhotoHeicFailedMessage('IMG_0001.HEIC')).toContain(
      'не удалось прочитать HEIC/HEIF',
    );
  });

  it('turns a multer size error into that sentence, including the client filename', () => {
    expect(messageForMulterError(sizeError('big-scan.jpg'), '/api/files/image')).toEqual({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: 'Файл «big-scan.jpg» больше 20 МБ',
    });
  });

  it('uses the font cap on the font upload route', () => {
    expect(messageForMulterError(sizeError('Display.ttf'), '/api/admin/uploads/font')).toEqual({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: 'Файл «Display.ttf» больше 5 МБ',
    });
  });

  it('leaves unrelated errors alone', () => {
    expect(messageForMulterError(new Error('nope'), '/api/files/image')).toBeNull();
  });
});
