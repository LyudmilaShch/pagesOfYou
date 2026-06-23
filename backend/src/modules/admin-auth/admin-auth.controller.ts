import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AdminJwtPayload } from './interfaces/admin-jwt-payload.interface';

@Public()
@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  // ---------------------------------------------------------------------------
  // POST /admin/auth/login
  // ---------------------------------------------------------------------------

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login with email + password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJ...',
          expiresIn: 28800,
          admin: { id: 'clx...', email: 'admin@example.com', name: null, role: 'ADMIN' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  // ---------------------------------------------------------------------------
  // POST /admin/auth/logout
  // ---------------------------------------------------------------------------

  @UseGuards(AdminJwtGuard, AdminRoleGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Admin logout (client should discard token)' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  logout() {
    // Admin tokens are stateless JWTs — no server-side revocation in MVP.
    // Client clears the token from localStorage.
  }

  // ---------------------------------------------------------------------------
  // GET /admin/auth/me
  // ---------------------------------------------------------------------------

  @UseGuards(AdminJwtGuard, AdminRoleGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current admin profile' })
  @ApiResponse({ status: 200, description: 'Admin profile' })
  getMe(@CurrentUser() admin: AdminJwtPayload) {
    return this.adminAuthService.getMe(admin.sub);
  }
}
