import { Injectable, Logger } from '@nestjs/common';
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
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>('r2.endpoint')!;
    const accessKeyId = config.get<string>('r2.accessKeyId')!;
    const secretAccessKey = config.get<string>('r2.secretAccessKey')!;

    this.bucketName = config.get<string>('r2.bucketName')!;
    this.publicUrl = config.get<string>('r2.publicUrl')!;

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async generateUploadUrl(options: PresignedUploadOptions): Promise<PresignedUploadResult> {
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
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.client.send(command);
    this.logger.debug(`Deleted file from R2: ${key}`);
  }

  getFileUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }
}
