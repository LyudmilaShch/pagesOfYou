import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  adminJwtConfig,
  appConfig,
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
import { AdminUploadsModule } from './modules/admin-uploads/admin-uploads.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrdersModule } from './modules/orders/orders.module';
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
      load: [appConfig, databaseConfig, jwtConfig, adminJwtConfig, otpConfig, r2Config, yandexStorageConfig],
      cache: true,
    }),

    // -------------------------------------------------------------------------
    // Database — global, PrismaService available everywhere
    // -------------------------------------------------------------------------
    PrismaModule,

    // -------------------------------------------------------------------------
    // Feature modules
    // -------------------------------------------------------------------------
    AuthModule,
    AdminAuthModule,
    AdminMagazineTypesModule,
    AdminMagazinePagesModule,
    AdminPhotoFramesModule,
    AdminUploadsModule,
    UsersModule,
    CatalogModule,
    OrdersModule,
    FilesModule,
    PaymentsModule,
    HealthModule,
  ],
})
export class AppModule {}

