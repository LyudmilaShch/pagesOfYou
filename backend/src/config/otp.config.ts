import { registerAs } from '@nestjs/config';

export const otpConfig = registerAs('otp', () => ({
  ttl: parseInt(process.env.OTP_CODE_TTL ?? '300', 10),
  maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '3', 10),
}));
