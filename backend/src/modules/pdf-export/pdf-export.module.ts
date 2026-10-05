import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PdfExportService } from './pdf-export.service';

@Module({
  // Empty JwtModule.register (mirrors AdminAuthModule) — PdfExportService signs its own
  // short-lived export token with the SAME adminJwt secret, passed per-call to JwtService.sign,
  // not configured here.
  imports: [JwtModule.register({})],
  providers: [PdfExportService],
  exports: [PdfExportService],
})
export class PdfExportModule {}
