import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * @Global() — PrismaService is injected application-wide without
 * explicit imports in every feature module.
 *
 * Import order in AppModule:
 *   ConfigModule  →  PrismaModule  →  feature modules
 *
 * PrismaService depends on ConfigService, so ConfigModule must be
 * loaded first (ensured by ConfigModule.forRoot({ isGlobal: true })).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
