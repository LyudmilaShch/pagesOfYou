import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ApplyPromoCodeDto } from './dto/apply-promo-code.dto';
import { CalculateDeliveryDto } from './dto/calculate-delivery.dto';
import { CreateDraftOrderDto } from './dto/create-draft-order.dto';
import { ReorderJournalSpreadsDto } from './dto/reorder-journal-spreads.dto';
import { SaveJournalPageCanvasDto } from './dto/save-journal-page-canvas.dto';
import { SetJournalPageTemplateDto } from './dto/set-journal-page-template.dto';
import { UpsertPlaceholdersDto } from './dto/upsert-placeholders.dto';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new draft order from magazine type pages' })
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateDraftOrderDto) {
    return this.ordersService.createDraft(user.sub, body);
  }

  @Get()
  @ApiOperation({ summary: 'Get current user orders' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.ordersService.findAllByUser(user.sub, +page, +limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order with journal pages and placeholder values' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.findOne(id, user.sub);
  }

  @Patch(':orderId/journal-pages/:journalPageId/placeholders')
  @ApiOperation({ summary: 'Save placeholder values for a journal page' })
  upsertPlaceholders(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Param('journalPageId') journalPageId: string,
    @Body() body: UpsertPlaceholdersDto,
  ) {
    return this.ordersService.upsertPlaceholders(orderId, journalPageId, user.sub, body);
  }

  @Patch(':orderId/journal-pages/:journalPageId/canvas')
  @ApiOperation({
    summary: 'Save the full page document (advanced per-element editor) — replaces pageSnapshot and clears placeholder diffs',
  })
  saveJournalPageCanvas(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Param('journalPageId') journalPageId: string,
    @Body() body: SaveJournalPageCanvasDto,
  ) {
    return this.ordersService.saveJournalPageCanvas(orderId, journalPageId, user.sub, body);
  }

  @Patch(':orderId/journal-pages/:journalPageId/template')
  @ApiOperation({ summary: 'Apply admin template(s) to a journal slot' })
  setJournalPageTemplate(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Param('journalPageId') journalPageId: string,
    @Body() body: SetJournalPageTemplateDto,
  ) {
    return this.ordersService.setJournalPageTemplate(orderId, journalPageId, user.sub, body);
  }

  @Post(':orderId/journal-spreads')
  @ApiOperation({ summary: 'Add a spread slot before the back cover' })
  addJournalSpread(@CurrentUser() user: JwtPayload, @Param('orderId') orderId: string) {
    return this.ordersService.addJournalSpread(orderId, user.sub);
  }

  @Patch(':orderId/journal-spreads/reorder')
  @ApiOperation({ summary: 'Reorder spread slots (cover and back cover stay fixed)' })
  reorderJournalSpreads(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Body() body: ReorderJournalSpreadsDto,
  ) {
    return this.ordersService.reorderJournalSpreads(orderId, user.sub, body);
  }

  @Post(':id/delivery/calculate')
  @ApiOperation({
    summary: 'Calculate (stubbed CDEK) and save delivery details for a draft order',
  })
  calculateDelivery(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: CalculateDeliveryDto,
  ) {
    return this.ordersService.calculateDelivery(id, user.sub, body);
  }

  @Post(':id/promo-code')
  @ApiOperation({ summary: 'Validate and apply a promo code to a draft order' })
  applyPromoCode(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: ApplyPromoCodeDto,
  ) {
    return this.ordersService.applyPromoCode(id, user.sub, body);
  }

  @Delete(':id/promo-code')
  @ApiOperation({ summary: 'Remove the promo code applied to a draft order' })
  removePromoCode(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.removePromoCode(id, user.sub);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit order (DRAFT → SUBMITTED)' })
  submit(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.submit(id, user.sub);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.cancel(id, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a draft order (soft delete) — only DRAFT orders can be deleted' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.remove(id, user.sub);
  }
}
