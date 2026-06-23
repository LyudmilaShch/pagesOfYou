import { Injectable, Logger } from '@nestjs/common';
import type {
  IPaymentProvider,
  CreatePaymentOptions,
  PaymentResult,
} from '../interfaces/payment-provider.interface';

/**
 * TODO: Implement YooKassa (formerly YandexKassa) payment provider.
 *
 * Docs: https://yookassa.ru/developers/api
 *
 * Required env vars:
 *   YUKASSA_SHOP_ID
 *   YUKASSA_SECRET_KEY
 */
@Injectable()
export class YukassaProvider implements IPaymentProvider {
  private readonly logger = new Logger(YukassaProvider.name);

  async createPayment(_options: CreatePaymentOptions): Promise<PaymentResult> {
    this.logger.log('createPayment — stub');
    throw new Error('YooKassa provider not implemented');
  }

  async handleWebhook(_payload: unknown): Promise<{ orderId: string; success: boolean }> {
    this.logger.log('handleWebhook — stub');
    throw new Error('YooKassa webhook not implemented');
  }

  async refund(_externalId: string, _amount: number): Promise<void> {
    this.logger.log('refund — stub');
    throw new Error('YooKassa refund not implemented');
  }
}
