export interface CreatePaymentOptions {
  orderId: string;
  amount: number;
  currency: string;
  description?: string;
  /** URL to redirect user after payment */
  returnUrl: string;
  /** Metadata to store alongside the payment */
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  /** Payment ID in the provider's system */
  externalId: string;
  /** URL to redirect the user for payment */
  confirmationUrl: string;
  /** Raw provider response — store in Payment.metadata */
  rawResponse: Record<string, unknown>;
}

export interface IPaymentProvider {
  /**
   * Initiate a payment and return a redirect URL.
   */
  createPayment(options: CreatePaymentOptions): Promise<PaymentResult>;

  /**
   * Handle an incoming webhook from the provider.
   * Returns the orderId and whether the payment succeeded.
   */
  handleWebhook(payload: unknown): Promise<{ orderId: string; success: boolean }>;

  /**
   * Initiate a full refund for a payment.
   */
  refund(externalId: string, amount: number): Promise<void>;
}
