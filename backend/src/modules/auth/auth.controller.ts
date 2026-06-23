import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ---------------------------------------------------------------------------
  // POST /auth/send-code
  // ---------------------------------------------------------------------------

  /**
   * Step 1 — Request an OTP via phone number.
   *
   * Rate limited: max 3 requests per phone per 10 minutes.
   * MVP: code is logged to the server console instead of sending SMS.
   */
  @Public()
  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request OTP code',
    description:
      'Send a 6-digit verification code to the phone number. ' +
      'Rate limited to 3 requests per 10 minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Code sent successfully',
    schema: {
      example: {
        success: true,
        data: { message: 'Verification code sent to +79001234567', expiresIn: 300 },
      },
    },
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  sendCode(@Body() dto: SendCodeDto, @Ip() ip: string) {
    return this.authService.sendCode(dto, ip);
  }

  // ---------------------------------------------------------------------------
  // POST /auth/verify-code
  // ---------------------------------------------------------------------------

  /**
   * Step 2 — Verify OTP and receive JWT tokens.
   *
   * Creates a new user account automatically if the phone is not registered.
   * Returns isNew=true for first-time users.
   */
  @Public()
  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and get tokens',
    description:
      'Verify the OTP code. Creates a new user on first login. ' +
      'Returns access + refresh JWT tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          expiresIn: 900,
          user: {
            id: 'clx...',
            phone: '+79001234567',
            name: null,
            role: 'USER',
            isNew: true,
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired code' })
  @ApiResponse({ status: 403, description: 'Account blocked' })
  verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyCode(dto);
  }

  // ---------------------------------------------------------------------------
  // POST /auth/refresh
  // ---------------------------------------------------------------------------

  /**
   * Rotate the access + refresh token pair.
   *
   * Each refresh token is single-use (rotation).
   * Reuse of an old token revokes the entire session.
   */
  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate token pair',
    description:
      'Exchange a valid refresh token for a new access + refresh token pair. ' +
      'The previous refresh token is invalidated immediately (single-use).',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens rotated',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          expiresIn: 900,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Refresh token invalid or revoked' })
  refresh(
    @CurrentUser() user: JwtPayload & { refreshToken: string },
    @Body() dto: RefreshTokenDto,
  ) {
    return this.authService.refresh(user.sub, dto.refreshToken);
  }

  // ---------------------------------------------------------------------------
  // POST /auth/logout
  // ---------------------------------------------------------------------------

  /**
   * Revoke the refresh token and end the session.
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout', description: 'Revoke refresh token and end session.' })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  logout(@CurrentUser() user: JwtPayload) {
    return this.authService.logout(user.sub);
  }
}
