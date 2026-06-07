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

// Marca cuándo se inició el servidor
export const serverStartedAt = new Date();

const isProd = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // En producción sólo errores y warnings; en desarrollo todo
    logger: isProd
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // ─── Seguridad HTTP ───────────────────────────────────────────────────────────
  app.use(helmet());

  // ─── Filtro global de excepciones ────────────────────────────────────────────
  // Respuesta uniforme { ok, statusCode, timestamp, path, message }
  app.useGlobalFilters(new HttpExceptionFilter());

  // ─── Body parsers ─────────────────────────────────────────────────────────────
  // Stripe webhook requiere raw body
  app.use('/pagos/webhook/stripe', bodyParser.raw({ type: 'application/json' }));
  app.use(bodyParser.json({ limit: '2mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));

  // ─── CORS ────────────────────────────────────────────────────────────────────
  // Define ALLOWED_ORIGINS en el .env como lista separada por comas:
  //   ALLOWED_ORIGINS=https://app.jelpy.com,https://admin.jelpy.com
  // En desarrollo se permiten todos los orígenes localhost/127.0.0.1 por defecto.
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS ??
      'http://localhost:4200,http://localhost:3000,http://localhost:8100,http://localhost:8101'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Permite peticiones sin origin (apps móviles nativas, Postman, server-to-server)
      if (!origin) {
        callback(null, true);
        return;
      }

      // En desarrollo permitir cualquier localhost / 127.0.0.1 sin importar el puerto
      const isLocalhost =
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin === 'http://localhost' ||
        origin === 'http://127.0.0.1';

      if (!isProd && isLocalhost) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origen no permitido → ${origin}`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // ─── Validaciones globales ───────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Archivos estáticos ──────────────────────────────────────────────────────
  const uploadPath = join(__dirname, '..', 'uploads', 'negocios', 'logos');
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  // ─── Swagger (sólo fuera de producción) ──────────────────────────────────────
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
    Logger.log(`Swagger disponible en /docs`, 'Bootstrap');
  }

  // ─── Levantar servidor ───────────────────────────────────────────────────────
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  const closeApp = async () => {
    Logger.log('Cerrando servidor...', 'Bootstrap');
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', closeApp);
  process.on('SIGINT', closeApp);

  Logger.log(`Servidor corriendo en http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
