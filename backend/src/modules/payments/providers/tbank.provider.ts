import { Injectable, Logger } from '@nestjs/common';
import type {
  IPaymentProvider,
  CreatePaymentOptions,
  PaymentResult,
} from '../interfaces/payment-provider.interface';

/**
 * TODO: Implement T-Bank (Tinkoff) payment provider.
 *
 * Docs: https://www.tbank.ru/kassa/dev/payments/
 *
 * Required env vars:
 *   TBANK_TERMINAL_KEY
 *   TBANK_SECRET_KEY
 */
@Injectable()
export class TBankProvider implements IPaymentProvider {
  private readonly logger = new Logger(TBankProvider.name);

  async createPayment(_options: CreatePaymentOptions): Promise<PaymentResult> {
    this.logger.log('createPayment — stub');
    throw new Error('T-Bank provider not implemented');
  }

  async handleWebhook(_payload: unknown): Promise<{ orderId: string; success: boolean }> {
    this.logger.log('handleWebhook — stub');
    throw new Error('T-Bank webhook not implemented');
  }

  async refund(_externalId: string, _amount: number): Promise<void> {
    this.logger.log('refund — stub');
    throw new Error('T-Bank refund not implemented');
  }
}
