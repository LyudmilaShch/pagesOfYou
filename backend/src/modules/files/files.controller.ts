import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FilesService, RequestUploadUrlDto } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Step 1: Request presigned upload URL.
   * Client receives uploadUrl and uploads file directly to R2 (no server proxy).
   */
  @Post('upload-url')
  @ApiOperation({ summary: 'Get presigned URL for direct upload to R2' })
  requestUploadUrl(@CurrentUser() user: JwtPayload, @Body() dto: RequestUploadUrlDto) {
    return this.filesService.requestUploadUrl(user.sub, dto);
  }

  /**
   * Step 2: Confirm the upload was successful.
   * Creates UploadedFile record in DB with storageKey.
   */
  @Post('confirm/:storageKey')
  @ApiOperation({ summary: 'Confirm file upload and register in DB' })
  confirm(
    @CurrentUser() user: JwtPayload,
    @Param('storageKey') storageKey: string,
    @Body() meta: { originalName: string; mimeType: string; size: number },
  ) {
    return this.filesService.confirmUpload(user.sub, storageKey, meta);
  }

  /**
   * List all files uploaded by the current user.
   */
  @Get()
  @ApiOperation({ summary: 'List my uploaded files' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.filesService.findAllByUser(user.sub);
  }

  /**
   * Soft-delete a file.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete uploaded file (soft delete)' })
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.filesService.deleteFile(id, user.sub);
  }
}
