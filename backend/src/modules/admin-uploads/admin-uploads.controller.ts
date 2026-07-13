import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { FileFilterCallback } from 'multer';
import type { Request } from 'express';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../admin-auth/guards/admin-role.guard';
import { Public } from '../../common/decorators/public.decorator';
import { AdminUploadsService } from './admin-uploads.service';
import {
  MAX_IMAGE_UPLOAD_SIZE_BYTES,
  MAX_IMAGE_UPLOAD_SIZE_MB,
} from '../../shared/constants/upload.constants';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

@Public()
@ApiTags('Admin — Uploads')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRoleGuard)
@Controller('admin/uploads')
export class AdminUploadsController {
  constructor(private readonly service: AdminUploadsService) {}

  /**
   * POST /api/admin/uploads/image
   *
   * Accepts a single image file (multipart/form-data field: "file").
   * Uploads it to Cloudflare R2 (magazine-types/ prefix) — never touches
   * the backend's own disk, which does not persist across deploys/restarts.
   * Returns { url } pointing to the publicly accessible R2 file.
   */
  @Post('image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload a cover image for magazine types / styles / spreads' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: `JPG, PNG or WebP ≤ ${MAX_IMAGE_UPLOAD_SIZE_MB} MB`,
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Upload successful',
    schema: {
      example: { success: true, data: { url: 'https://pub-xxx.r2.dev/magazine-types/uuid.jpg' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Неподдерживаемый формат. Разрешены: JPG, PNG, WebP.',
            ),
          );
        }
      },
      limits: { fileSize: MAX_IMAGE_UPLOAD_SIZE_BYTES },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.service.uploadImage(file);
  }
}
