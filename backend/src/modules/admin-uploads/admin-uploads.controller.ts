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
import type { Request } from 'express';
import { diskStorage } from 'multer';
import type { FileFilterCallback } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
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
   * Saves it to uploads/magazine-types/ on disk.
   * Returns { url } pointing to the publicly accessible file.
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
      example: { success: true, data: { url: 'http://localhost:3000/uploads/magazine-types/uuid.jpg' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (
          _req: Request,
          _file: Express.Multer.File,
          cb: (error: Error | null, destination: string) => void,
        ) => {
          const dest = join(process.cwd(), 'uploads', 'magazine-types');
          if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (
          _req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const ext = extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
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
    return this.service.getImageUrl(file);
  }
}
