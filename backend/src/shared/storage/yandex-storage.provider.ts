import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  IStorageProvider,
  PresignedUploadOptions,
  PresignedUploadResult,
} from '../../modules/files/interfaces/storage-provider.interface';

/**
 * Server-side storage on Yandex Object Storage (S3-compatible) — used for both admin-uploaded
 * assets (magazine type covers, page previews, photo frames) and customer/admin order photos
 * (see FilesService). Chosen over Cloudflare R2 for the same reason as YandexGPT: the site must
 * run reliably inside Russia, and this account/bucket was already set up and working for admin
 * uploads, so order photos reuse it too rather than requiring a separate Cloudflare account.
 * The backend's own disk is ephemeral in production and must not be relied on for persistence.
 */
@Injectable()
export class YandexStorageProvider implements IStorageProvider {
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
          'Uploads will fail until these are set.',
      );
    }

    this.client = new S3Client({
      region,
      endpoint: this.endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: accessKeyId ?? '', secretAccessKey: secretAccessKey ?? '' },
    });
  }

  private assertConfigured(): void {
    if (this.missingEnvVars.length > 0) {
      throw new InternalServerErrorException(
        `Yandex Object Storage не настроен на сервере: отсутствуют переменные окружения ${this.missingEnvVars.join(', ')}.`,
      );
    }
  }

  async uploadBuffer(key: string, body: Buffer, contentType: string): Promise<string> {
    this.assertConfigured();

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
    return this.getFileUrl(key);
  }

  async generateUploadUrl(options: PresignedUploadOptions): Promise<PresignedUploadResult> {
    this.assertConfigured();
    const { key, contentType, expiresIn = 900 } = options;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read',
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    const publicUrl = this.getFileUrl(key);

    this.logger.debug(`Generated presigned upload URL for key: ${key}`);
    return { uploadUrl, publicUrl, key };
  }

  async deleteFile(key: string): Promise<void> {
    this.assertConfigured();

    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
    this.logger.debug(`Deleted file from Yandex Object Storage: ${key}`);
  }

  getFileUrl(key: string): string {
    this.assertConfigured();
    return `${this.endpoint}/${this.bucketName}/${key}`;
  }
}
