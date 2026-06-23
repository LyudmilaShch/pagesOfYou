import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  BeforeApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, BeforeApplicationShutdown
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly isDev: boolean;

  constructor(private readonly config: ConfigService) {
    const nodeEnv = config.get<string>('app.nodeEnv') ?? process.env.NODE_ENV;
    const isDev = nodeEnv === 'development';

    super({
      // DATABASE_URL is read by Prisma from the environment automatically
      // (via `url = env("DATABASE_URL")` in schema.prisma).
      // We do NOT override datasources here — passing `undefined` would crash.
      log: isDev
        ? [
            // In development: capture query events for timing logs
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [
            // In production: only warnings and errors to stdout
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ],
    });

    this.isDev = isDev;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to PostgreSQL...');

    if (this.isDev) {
      // Log each SQL query with its execution time in development
      (this as unknown as PrismaClient).$on(
        'query' as never,
        (event: Prisma.QueryEvent) => {
          this.logger.debug(
            `[Query] ${event.query} — ${event.duration}ms`,
            event.params,
          );
        },
      );
    }

    await this.$connect();
    this.logger.log('PostgreSQL connected.');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting from PostgreSQL...');
    await this.$disconnect();
    this.logger.log('PostgreSQL disconnected.');
  }

  /**
   * Prisma does not automatically handle SIGTERM/SIGINT — this hook ensures
   * the connection pool is drained before the process exits.
   */
  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Graceful shutdown triggered (signal: ${signal ?? 'unknown'}).`);
    await this.$disconnect();
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * Check that the database is reachable.
   * Used in health checks and integration test setup.
   */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Truncate all user tables. ONLY available in test environment.
   * Use in afterEach/afterAll to keep integration tests isolated.
   */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase() is only allowed in the test environment.');
    }

    const tables = await this.$queryRaw<{ tablename: string }[]>`
      SELECT tablename
      FROM   pg_tables
      WHERE  schemaname = 'public'
        AND  tablename  != '_prisma_migrations'
    `;

    for (const { tablename } of tables) {
      await this.$executeRawUnsafe(
        `TRUNCATE TABLE "${tablename}" RESTART IDENTITY CASCADE`,
      );
    }
  }
}
