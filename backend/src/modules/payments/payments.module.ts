import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { YukassaProvider } from './providers/yukassa.provider';
import { TBankProvider } from './providers/tbank.provider';

@Module({
  providers: [PaymentsService, YukassaProvider, TBankProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
