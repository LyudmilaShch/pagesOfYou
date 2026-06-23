import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public — JwtAuthGuard will skip authentication.
 *
 * Usage:
 *   @Public()
 *   @Post('send-code')
 *   sendCode() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
