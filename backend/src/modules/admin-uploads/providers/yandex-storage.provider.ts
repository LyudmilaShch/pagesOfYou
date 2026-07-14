import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Server-side upload to Yandex Object Storage (S3-compatible) — used for
 * admin-uploaded assets (magazine type covers, page previews, photo frames).
 * The backend's own disk is ephemeral in production and must not be relied
 * on for persistence.
 */
@Injectable()
export class YandexStorageProvider {
  private readonly logger = new Logger(YandexStorageProvider.name);
  private readonly client: S3Client;
  private readonly bucketName?: string;
  private readonly endpoint: string;
  private readonly missingEnvVars: string[];

  constructor(config: ConfigService) {
    const accessKeyId = config.get<string>('yandexStorage.accessKeyId');
    const secretAccessKey = config.get<string>('yandexStorage.secretAccessKey');
    const region = config.get<string>('yandexStorage.region') ?? 'ru-central1';

    this.bucketName = config.get<string>('yandexStorage.bucketName');
    this.endpoint = config.get<string>('yandexStorage.endpoint') ?? 'https://storage.yandexcloud.net';

    this.missingEnvVars = Object.entries({
      YANDEX_STORAGE_ACCESS_KEY_ID: accessKeyId,
      YANDEX_STORAGE_SECRET_ACCESS_KEY: secretAccessKey,
      YANDEX_STORAGE_BUCKET_NAME: this.bucketName,
    })
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (this.missingEnvVars.length > 0) {
      this.logger.error(
        `Yandex Object Storage is not configured — missing environment variable(s): ${this.missingEnvVars.join(', ')}. ` +
          'Admin uploads will fail until these are set.',
      );
    }

    this.client = new S3Client({
      region,
      endpoint: this.endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: accessKeyId ?? '', secretAccessKey: secretAccessKey ?? '' },
    });
  }

  async uploadBuffer(key: string, body: Buffer, contentType: string): Promise<string> {
    if (this.missingEnvVars.length > 0) {
      throw new InternalServerErrorException(
        `Yandex Object Storage не настроен на сервере: отсутствуют переменные окружения ${this.missingEnvVars.join(', ')}.`,
      );
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: 'public-read',
      }),
    );

    this.logger.debug(`Uploaded buffer to Yandex Object Storage: ${key}`);

    return `${this.endpoint}/${this.bucketName}/${key}`;
  }
}
