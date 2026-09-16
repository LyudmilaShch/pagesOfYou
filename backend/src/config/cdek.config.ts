import { registerAs } from '@nestjs/config';

/** CDEK API v2 credentials — obtained from the CDEK integrator cabinet. Until these are set,
 * `CdekService` can't authenticate and `CdekController`'s routes return a clear "not configured"
 * error rather than failing with an opaque upstream 401. */
export const cdekConfig = registerAs('cdek', () => ({
  clientId: process.env.CDEK_CLIENT_ID,
  clientSecret: process.env.CDEK_CLIENT_SECRET,
  apiUrl: process.env.CDEK_API_URL ?? 'https://api.cdek.ru/v2',
  fromCity: process.env.CDEK_FROM_CITY ?? 'Москва',
}));
