import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { getCorsOrigins } from './common/utils/cors.util';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ---------------------------------------------------------------------------
  // Static files — uploads served at /uploads/* (outside the /api prefix)
  // ---------------------------------------------------------------------------
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // ---------------------------------------------------------------------------
  // Global prefix
  // ---------------------------------------------------------------------------
  app.setGlobalPrefix('api');

  // ---------------------------------------------------------------------------
  // CORS — allow requests from the Vue frontend
  // ---------------------------------------------------------------------------
  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ---------------------------------------------------------------------------
  // Global validation pipe
  // ---------------------------------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ---------------------------------------------------------------------------
  // Global exception filter — unified error response format
  // ---------------------------------------------------------------------------
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ---------------------------------------------------------------------------
  // Global response interceptor — wraps data in { success: true, data: ... }
  // ---------------------------------------------------------------------------
  app.useGlobalInterceptors(new TransformInterceptor());

  // ---------------------------------------------------------------------------
  // Global JWT guard — all routes require auth unless decorated with @Public()
  // ---------------------------------------------------------------------------
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // ---------------------------------------------------------------------------
  // Swagger — available at /api/docs
  // ---------------------------------------------------------------------------
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pages of You API')
    .setDescription('SaaS API for personalized magazines')
    .setVersion('1.0')
    .addBearerAuth()
    .addServer('http://localhost:3000', 'Local')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
    },
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown — NestJS calls BeforeApplicationShutdown hooks on signals
  // ---------------------------------------------------------------------------
  app.enableShutdownHooks();

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`\n🚀  Backend running at: http://localhost:${port}/api`);
  console.log(`📖  Swagger docs:       http://localhost:${port}/api/docs\n`);
}

bootstrap();
