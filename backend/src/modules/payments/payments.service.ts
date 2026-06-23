import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * TODO: Create payment for an order.
   * Selects provider based on user choice, calls provider.createPayment(),
   * saves Payment record, returns confirmation URL.
   */
  async initiatePayment(_orderId: string, _userId: string, _provider: string) {
    this.logger.log('initiatePayment — stub');
    throw new Error('Not implemented');
  }

  /**
   * TODO: Handle payment webhook from provider.
   * Validates signature, updates Payment status, updates Order status to PAID,
   * creates OrderEvent PAYMENT_RECEIVED.
   */
  async handleWebhook(_provider: string, _payload: unknown, _signature?: string) {
    this.logger.log('handleWebhook — stub');
    throw new Error('Not implemented');
  }

  /**
   * TODO: Process refund for an order.
   */
  async refund(_paymentId: string, _adminId: string) {
    this.logger.log('refund — stub');
    throw new Error('Not implemented');
  }
}
