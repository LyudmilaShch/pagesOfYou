import { Module } from '@nestjs/common';
import { AdminPromoCodesController } from './admin-promo-codes.controller';
import { AdminPromoCodesService } from './admin-promo-codes.service';

@Module({
  controllers: [AdminPromoCodesController],
  providers: [AdminPromoCodesService],
  exports: [AdminPromoCodesService],
})
export class AdminPromoCodesModule {}
