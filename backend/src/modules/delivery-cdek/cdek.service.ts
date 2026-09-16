import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface CachedToken {
  token: string;
  expiresAt: number;
}

interface CdekTokenResponse {
  access_token: string;
  expires_in: number;
}

/** Thin proxy over the real CDEK API v2 — the widget's `servicePath` can't call CDEK directly
 * (that would expose the account's client_secret in the browser), so this authenticates
 * server-side and forwards the request. See https://api-docs.cdek.ru for the upstream contract;
 * the exact shape the widget's own compiled JS sends to `servicePath` isn't published, so
 * `CdekController` routes by the conventional query shape and may need adjusting once tested
 * against a live widget instance. */
@Injectable()
export class CdekService {
  private readonly logger = new Logger(CdekService.name);
  private cachedToken: CachedToken | null = null;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.clientId() && this.clientSecret());
  }

  async calculateTariff(payload: Record<string, unknown>): Promise<unknown> {
    const token = await this.getAccessToken();

    const { data } = await firstValueFrom(
      this.http.post(`${this.apiUrl()}/calculator/tarifflist`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    return data;
  }

  async listDeliveryPoints(params: Record<string, unknown>): Promise<unknown> {
    const token = await this.getAccessToken();

    const { data } = await firstValueFrom(
      this.http.get(`${this.apiUrl()}/deliverypoints`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      }),
    );

    return data;
  }

  private async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Интеграция с СДЭК ещё не настроена (нет CDEK_CLIENT_ID/CDEK_CLIENT_SECRET).',
      );
    }

    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    const { data } = await firstValueFrom(
      this.http.post<CdekTokenResponse>(`${this.apiUrl()}/oauth/token`, null, {
        params: {
          grant_type: 'client_credentials',
          client_id: this.clientId(),
          client_secret: this.clientSecret(),
        },
      }),
    );

    // Refresh a little early so an in-flight request never races the real expiry.
    this.cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + Math.max(0, data.expires_in - 30) * 1000,
    };

    this.logger.log('CDEK access token refreshed');
    return this.cachedToken.token;
  }

  private apiUrl(): string {
    return this.config.get<string>('cdek.apiUrl') ?? 'https://api.cdek.ru/v2';
  }

  private clientId(): string | undefined {
    return this.config.get<string>('cdek.clientId');
  }

  private clientSecret(): string | undefined {
    return this.config.get<string>('cdek.clientSecret');
  }
}
