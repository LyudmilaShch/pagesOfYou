import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Create new DRAFT order — entry point for the order wizard.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new draft order' })
  create(@CurrentUser() user: JwtPayload, @Body() body: unknown) {
    return this.ordersService.createDraft(user.sub, body);
  }

  /**
   * List orders for the current user with pagination.
   */
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

  /**
   * Get a single order with all spreads and field values.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get order details' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.findOne(id, user.sub);
  }

  /**
   * Update draft order contents (spreads, field values).
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update draft order' })
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: unknown) {
    return this.ordersService.updateDraft(id, user.sub, body);
  }

  /**
   * Submit the order: triggers snapshot capture and moves to payment.
   */
  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit order (DRAFT → SUBMITTED)' })
  submit(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.submit(id, user.sub);
  }

  /**
   * Cancel the order (allowed only in DRAFT / SUBMITTED states).
   */
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.cancel(id, user.sub);
  }
}
