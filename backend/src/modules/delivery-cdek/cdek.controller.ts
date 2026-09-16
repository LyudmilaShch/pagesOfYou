import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CdekService } from './cdek.service';
import { Public } from '../../common/decorators/public.decorator';

/** Entry point the CDEK widget's `servicePath` option is pointed at (see `CheckoutPage.vue`) —
 * reachable directly from the browser, unauthenticated, since the widget has no notion of this
 * app's JWTs. Routing between "list pickup points" and "calculate tariff" is a best guess at the
 * widget's actual request shape (undocumented) — adjust once tested against a live widget. */
@Public()
@ApiTags('Delivery — CDEK')
@Controller('delivery/cdek')
export class CdekController {
  constructor(private readonly cdek: CdekService) {}

  @Get('service')
  @ApiOperation({ summary: 'CDEK widget servicePath proxy (GET — pickup points / tariff by query)' })
  service(@Query() query: Record<string, string>) {
    if (this.looksLikeDeliveryPointsQuery(query)) {
      return this.cdek.listDeliveryPoints(query);
    }

    return this.cdek.calculateTariff(query);
  }

  @Post('service')
  @ApiOperation({ summary: 'CDEK widget servicePath proxy (POST — tariff calculation by body)' })
  serviceViaPost(@Body() body: Record<string, unknown>) {
    return this.cdek.calculateTariff(body);
  }

  private looksLikeDeliveryPointsQuery(query: Record<string, string>): boolean {
    return (
      query.type === 'offices' ||
      query.type === 'nearest' ||
      'city_code' in query ||
      'postal_code' in query
    );
  }
}
