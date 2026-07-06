import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import type { FileFilterCallback } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { FilesService, RequestUploadUrlDto } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { MAX_IMAGE_UPLOAD_SIZE_BYTES } from '../../shared/constants/upload.constants';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-url')
  @ApiOperation({ summary: 'Get presigned URL for direct upload to R2' })
  requestUploadUrl(@CurrentUser() user: JwtPayload, @Body() dto: RequestUploadUrlDto) {
    return this.filesService.requestUploadUrl(user.sub, dto);
  }

  @Post('image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload image for order placeholders (local disk)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (
          _req,
          _file,
          cb: (error: Error | null, destination: string) => void,
        ) => {
          const dest = join(process.cwd(), 'uploads', 'order-photos');
          if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_IMAGE_UPLOAD_SIZE_BYTES },
      fileFilter: (_req, file, cb: FileFilterCallback) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(new BadRequestException('Unsupported file type'));
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    return this.filesService.registerLocalUpload(user.sub, file);
  }

  @Post('confirm/:storageKey')
  @ApiOperation({ summary: 'Confirm file upload and register in DB' })
  confirm(
    @CurrentUser() user: JwtPayload,
    @Param('storageKey') storageKey: string,
    @Body() meta: { originalName: string; mimeType: string; size: number },
  ) {
    return this.filesService.confirmUpload(user.sub, storageKey, meta);
  }

  @Get()
  @ApiOperation({ summary: 'List my uploaded files' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.filesService.findAllByUser(user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete uploaded file (soft delete)' })
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.filesService.deleteFile(id, user.sub);
  }
}
