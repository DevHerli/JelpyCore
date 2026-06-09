import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import { join } from 'path';
import * as fs from 'fs';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

export const serverStartedAt = new Date();

const isProd = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: isProd
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.use(helmet());

  app.useGlobalFilters(new HttpExceptionFilter());

  app.use('/pagos/webhook/stripe', bodyParser.raw({ type: 'application/json' }));
  app.use(bodyParser.json({ limit: '2mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));

  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS ??
    [
      'http://localhost:4200',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8100',
      'http://localhost:8101',
      'http://localhost',
      'https://localhost',
      'http://127.0.0.1',
      'https://127.0.0.1',
      'capacitor://localhost',
      'ionic://localhost',
      'https://jelpy.mx',
      'https://www.jelpy.mx',
    ].join(',')
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = origin.trim();

      if (allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      const isLocalhost =
        normalizedOrigin.startsWith('http://localhost:') ||
        normalizedOrigin.startsWith('https://localhost:') ||
        normalizedOrigin.startsWith('http://127.0.0.1:') ||
        normalizedOrigin.startsWith('https://127.0.0.1:') ||
        normalizedOrigin === 'http://localhost' ||
        normalizedOrigin === 'https://localhost' ||
        normalizedOrigin === 'http://127.0.0.1' ||
        normalizedOrigin === 'https://127.0.0.1';

      const isMobileWebView =
        normalizedOrigin === 'capacitor://localhost' ||
        normalizedOrigin === 'ionic://localhost';

      if (!isProd && (isLocalhost || isMobileWebView)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS: origen no permitido → ${normalizedOrigin}`));
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const uploadPath = join(__dirname, '..', 'uploads', 'negocios', 'logos');

  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Jelpy Core API')
      .setDescription('Corazón de Jelpy: búsqueda semántica + datos')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    Logger.log('Swagger disponible en /docs', 'Bootstrap');
  }

  const port = process.env.PORT || 3001;

  await app.listen(port, '0.0.0.0');

  const closeApp = async () => {
    Logger.log('Cerrando servidor...', 'Bootstrap');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', closeApp);
  process.on('SIGINT', closeApp);

  Logger.log(`Servidor corriendo en puerto ${port}`, 'Bootstrap');
}

bootstrap();