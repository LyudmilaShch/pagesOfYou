import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FilesService, RequestUploadUrlDto } from './files.service';
import { orderPhotoUploadInterceptor } from './order-photo-upload.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ClaimGuestPhotosDto, SetFavoriteDto, UploadImageDto } from './dto/gallery.dto';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload-url')
  @ApiOperation({ summary: 'Get presigned URL for direct upload to R2' })
  requestUploadUrl(@CurrentUser() user: JwtPayload, @Body() dto: RequestUploadUrlDto) {
    return this.filesService.requestUploadUrl(user.sub, dto);
  }

  // Public + optional auth: reachable by signed-in users (general uploads, or their own order's
  // gallery) and by guests (their own guest gallery, via `guestId` — see gallery.dto.ts).
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload image for order placeholders / journal photo gallery' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        orderId: { type: 'string' },
        guestId: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(orderPhotoUploadInterceptor())
  uploadImage(
    @CurrentUser() user: JwtPayload | undefined,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadImageDto,
  ) {
    return this.filesService.registerLocalUpload(file, { userId: user?.sub }, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('confirm/:storageKey')
  @ApiOperation({ summary: 'Confirm file upload and register in DB' })
  confirm(
    @CurrentUser() user: JwtPayload,
    @Param('storageKey') storageKey: string,
    @Body() meta: { originalName: string; mimeType: string; size: number },
  ) {
    return this.filesService.confirmUpload(user.sub, storageKey, meta);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List gallery photos — pass orderId or guestId to scope the list' })
  findAll(
    @CurrentUser() user: JwtPayload | undefined,
    @Query('orderId') orderId?: string,
    @Query('guestId') guestId?: string,
  ) {
    return this.filesService.list({ userId: user?.sub }, { orderId, guestId });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Patch(':id/favorite')
  @ApiOperation({ summary: 'Mark/unmark a gallery photo as favorite' })
  setFavorite(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id') id: string,
    @Query('guestId') guestId: string | undefined,
    @Body() body: SetFavoriteDto,
  ) {
    return this.filesService.setFavorite(id, { userId: user?.sub, guestId }, body.isFavorite);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete uploaded file (soft delete)' })
  delete(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id') id: string,
    @Query('guestId') guestId?: string,
  ) {
    return this.filesService.deleteFile(id, { userId: user?.sub, guestId });
  }

  @UseGuards(JwtAuthGuard)
  @Post('claim-guest-photos')
  @ApiOperation({ summary: "Re-parent a guest's gallery photos onto a real order" })
  claimGuestPhotos(@CurrentUser() user: JwtPayload, @Body() body: ClaimGuestPhotosDto) {
    return this.filesService.claimGuestPhotos(body.guestId, body.orderId, user.sub);
  }
}
