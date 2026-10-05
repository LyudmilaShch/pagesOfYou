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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminOrdersService } from './admin-orders.service';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { UploadOrderPhotoDto } from './dto/upload-order-photo.dto';
import { SaveJournalPageCanvasDto } from '../orders/dto/save-journal-page-canvas.dto';
import { SetFavoriteDto } from '../files/dto/gallery.dto';
import { orderPhotoUploadInterceptor } from '../files/order-photo-upload.interceptor';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../admin-auth/guards/admin-role.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AdminJwtPayload } from '../admin-auth/interfaces/admin-jwt-payload.interface';
import { PdfExportService } from '../pdf-export/pdf-export.service';

@Public()
@ApiTags('Admin — Orders')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRoleGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly service: AdminOrdersService,
    private readonly pdfExportService: PdfExportService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List orders (paginated)',
    description: 'Defaults to every status except DRAFT — only orders customers have actually placed.',
  })
  findAll(@Query() query: GetOrdersQueryDto) {
    return this.service.findAll(query);
  }

  // Must stay registered before `:id` below — otherwise Nest would match "stats" as an :id value.
  @Get('stats')
  @ApiOperation({ summary: 'Order counts by status, for the admin dashboard summary widget' })
  getStats() {
    return this.service.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by id, with journal pages' })
  @ApiParam({ name: 'id', description: 'Prisma cuid' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // Bypasses the global TransformInterceptor's { success, data } JSON envelope via a raw @Res() —
  // this sends actual PDF bytes, not JSON. See PdfExportService's own doc comments for the full
  // Puppeteer → pdf-lib → Ghostscript pipeline this drives.
  @Get(':id/export-pdf')
  @ApiOperation({ summary: 'Export the order journal as a print-ready CMYK PDF' })
  @ApiParam({ name: 'id', description: 'Prisma cuid' })
  async exportPdf(
    @Param('id') id: string,
    @CurrentUser() admin: AdminJwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const order = await this.service.findOne(id);
    const rgbPdf = await this.pdfExportService.buildPdf(order, admin);
    const cmykPdf = await this.pdfExportService.convertToCmyk(rgbPdf);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="order-${id}.pdf"`,
      'Content-Length': String(cmykPdf.length),
    });
    res.send(cmykPdf);
  }

  @Get(':orderId/journal-pages/:journalPageId')
  @ApiOperation({ summary: 'Get a single journal page (full document) for the advanced editor' })
  getJournalPage(
    @Param('orderId') orderId: string,
    @Param('journalPageId') journalPageId: string,
  ) {
    return this.service.getJournalPage(orderId, journalPageId);
  }

  @Patch(':orderId/journal-pages/:journalPageId/canvas')
  @ApiOperation({
    summary: 'Save the full page document from the admin editor — replaces pageSnapshot and clears placeholder diffs',
  })
  saveJournalPageCanvas(
    @Param('orderId') orderId: string,
    @Param('journalPageId') journalPageId: string,
    @Body() body: SaveJournalPageCanvasDto,
  ) {
    return this.service.saveJournalPageCanvas(orderId, journalPageId, body);
  }

  @Get(':orderId/photos')
  @ApiOperation({ summary: "List an order's photo gallery" })
  listPhotos(@Param('orderId') orderId: string) {
    return this.service.listPhotos(orderId);
  }

  @Post(':orderId/photos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Upload a photo into an order's gallery" })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        width: { type: 'number' },
        height: { type: 'number' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(orderPhotoUploadInterceptor())
  uploadPhoto(
    @Param('orderId') orderId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadOrderPhotoDto,
  ) {
    return this.service.uploadPhoto(orderId, file, body);
  }

  @Patch(':orderId/photos/:fileId/favorite')
  @ApiOperation({ summary: 'Mark/unmark a gallery photo as favorite' })
  setPhotoFavorite(
    @Param('orderId') orderId: string,
    @Param('fileId') fileId: string,
    @Body() body: SetFavoriteDto,
  ) {
    return this.service.setPhotoFavorite(orderId, fileId, body.isFavorite);
  }

  @Delete(':orderId/photos/:fileId')
  @ApiOperation({ summary: 'Delete a gallery photo' })
  deletePhoto(@Param('orderId') orderId: string, @Param('fileId') fileId: string) {
    return this.service.deletePhoto(orderId, fileId);
  }
}
