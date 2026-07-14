import { registerAs } from '@nestjs/config';

export const yandexStorageConfig = registerAs('yandexStorage', () => ({
  accessKeyId: process.env.YANDEX_STORAGE_ACCESS_KEY_ID,
  secretAccessKey: process.env.YANDEX_STORAGE_SECRET_ACCESS_KEY,
  bucketName: process.env.YANDEX_STORAGE_BUCKET_NAME,
  // Yandex Object Storage S3-compatible endpoint
  endpoint: 'https://storage.yandexcloud.net',
  region: 'ru-central1',
}));
