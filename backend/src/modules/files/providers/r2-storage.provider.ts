import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  IStorageProvider,
  PresignedUploadOptions,
  PresignedUploadResult,
} from '../interfaces/storage-provider.interface';

@Injectable()
export class R2StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(R2StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucketName?: string;
  private readonly publicUrl?: string;
  private readonly missingEnvVars: string[];

  constructor(private readonly config: ConfigService) {
    const accountId = config.get<string>('r2.accountId');
    const accessKeyId = config.get<string>('r2.accessKeyId');
    const secretAccessKey = config.get<string>('r2.secretAccessKey');

    this.bucketName = config.get<string>('r2.bucketName');
    this.publicUrl = config.get<string>('r2.publicUrl');

    this.missingEnvVars = Object.entries({
      R2_ACCOUNT_ID: accountId,
      R2_ACCESS_KEY_ID: accessKeyId,
      R2_SECRET_ACCESS_KEY: secretAccessKey,
      R2_BUCKET_NAME: this.bucketName,
      R2_PUBLIC_URL: this.publicUrl,
    })
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (this.missingEnvVars.length > 0) {
      this.logger.error(
        `R2 is not configured — missing environment variable(s): ${this.missingEnvVars.join(', ')}. ` +
          'Uploads to R2 will fail until these are set.',
      );
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: config.get<string>('r2.endpoint'),
      credentials: { accessKeyId: accessKeyId ?? '', secretAccessKey: secretAccessKey ?? '' },
    });
  }

  private assertConfigured(): void {
    if (this.missingEnvVars.length > 0) {
      throw new InternalServerErrorException(
        `Хранилище R2 не настроено на сервере: отсутствуют переменные окружения ${this.missingEnvVars.join(', ')}.`,
      );
    }
  }

  async generateUploadUrl(options: PresignedUploadOptions): Promise<PresignedUploadResult> {
    this.assertConfigured();
    const { key, contentType, expiresIn = 900 } = options;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    const publicUrl = this.getFileUrl(key);

    this.logger.debug(`Generated presigned upload URL for key: ${key}`);
    return { uploadUrl, publicUrl, key };
  }

  async deleteFile(key: string): Promise<void> {
    this.assertConfigured();

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.client.send(command);
    this.logger.debug(`Deleted file from R2: ${key}`);
  }

  getFileUrl(key: string): string {
    this.assertConfigured();
    return `${this.publicUrl}/${key}`;
  }
}
