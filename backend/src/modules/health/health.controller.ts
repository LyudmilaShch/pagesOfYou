import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { PrismaService } from '../../database';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Liveness probe — confirms the server and the database are operational.
   *
   * GET /api/health
   * Response: { status: "ok", info: { database: { status: "up" } } }
   */
  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Application liveness probe' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      (): Promise<HealthIndicatorResult> => this.checkDatabase(),
    ]);
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    const isReachable = await this.prisma.ping();
    if (isReachable) {
      return { database: { status: 'up' } };
    }
    throw new Error('Database is unreachable');
  }
}
