import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  adminJwtConfig,
  appConfig,
  cdekConfig,
  databaseConfig,
  jwtConfig,
  otpConfig,
  r2Config,
  yandexStorageConfig,
} from './config';
import { PrismaModule } from './database';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AdminMagazineTypesModule } from './modules/admin-magazine-types/admin-magazine-types.module';
import { AdminMagazinePagesModule } from './modules/admin-magazine-pages/admin-magazine-pages.module';
import { AdminPhotoFramesModule } from './modules/admin-photo-frames/admin-photo-frames.module';
import { AdminCustomPhotoMasksModule } from './modules/admin-custom-photo-masks/admin-custom-photo-masks.module';
import { AdminFontsModule } from './modules/admin-fonts/admin-fonts.module';
import { AdminUploadsModule } from './modules/admin-uploads/admin-uploads.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AdminOrdersModule } from './modules/admin-orders/admin-orders.module';
import { AdminPromoCodesModule } from './modules/admin-promo-codes/admin-promo-codes.module';
import { AdminSettingsModule } from './modules/admin-settings/admin-settings.module';
import { DeliveryCdekModule } from './modules/delivery-cdek/delivery-cdek.module';
import { FilesModule } from './modules/files/files.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // -------------------------------------------------------------------------
    // Config — must be first, all other modules depend on it
    // -------------------------------------------------------------------------
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        adminJwtConfig,
        otpConfig,
        r2Config,
        yandexStorageConfig,
        cdekConfig,
      ],
      cache: true,
    }),

    // -------------------------------------------------------------------------
    // Database — global, PrismaService available everywhere
    // -------------------------------------------------------------------------
    PrismaModule,

    // -------------------------------------------------------------------------
    // Global IP-based rate limiting — a generous ceiling meant to catch scripted
    // abuse, not normal SPA traffic (the editor/admin can legitimately burst many
    // requests per second). Sensitive endpoints (send-code, verify-code, admin
    // login) tighten this further with their own @Throttle() override.
    // -------------------------------------------------------------------------
    ThrottlerModule.forRoot([{ ttl: 10_000, limit: 100 }]),

    // -------------------------------------------------------------------------
    // Feature modules
    // -------------------------------------------------------------------------
    AuthModule,
    AdminAuthModule,
    AdminMagazineTypesModule,
    AdminMagazinePagesModule,
    AdminPhotoFramesModule,
    AdminCustomPhotoMasksModule,
    AdminFontsModule,
    AdminUploadsModule,
    UsersModule,
    CatalogModule,
    OrdersModule,
    AdminOrdersModule,
    AdminPromoCodesModule,
    AdminSettingsModule,
    DeliveryCdekModule,
    FilesModule,
    PaymentsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

