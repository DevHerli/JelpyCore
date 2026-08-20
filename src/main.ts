import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import { join } from 'path';
import * as fs from 'fs';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

export const serverStartedAt = new Date();

/**
 * Detección de entorno con política fail-closed.
 *
 * Antes: `isProd = NODE_ENV === 'production'`. Si NODE_ENV no estaba definido
 * (el caso real en Render), isProd quedaba en false y el servidor exponía
 * Swagger en /docs y /docs-json públicamente: 237 rutas, 309 operaciones y
 * 78 DTOs con nombres de parámetros y reglas de validación, sin autenticación.
 *
 * Ahora se invierte la carga de la prueba: solo los entornos locales conocidos
 * se consideran no-producción. Cualquier otro valor —incluido NODE_ENV ausente
 * o mal escrito— se trata como producción y por tanto se endurece.
 */
const LOCAL_ENVS = ['development', 'dev', 'local', 'test', 'qa'];
const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
const isProd = !LOCAL_ENVS.includes(nodeEnv);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: isProd
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.use(helmet());

  app.useGlobalFilters(new HttpExceptionFilter());

  // Raw body para webhooks de Stripe — DEBE ir antes del bodyParser.json global
  app.use('/pagos/webhook/stripe', bodyParser.raw({ type: 'application/json' }));
  app.use('/billing/webhook',      bodyParser.raw({ type: 'application/json' }));
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

      // Capacitor/Ionic en dispositivo físico — siempre permitido (no es spoofeble desde browser)
      const isMobileWebView =
        normalizedOrigin === 'capacitor://localhost' ||
        normalizedOrigin === 'ionic://localhost' ||
        normalizedOrigin === 'https://localhost';

      if (isMobileWebView) {
        callback(null, true);
        return;
      }

      if (!isProd && isLocalhost) {
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

  // ── Swagger: ELIMINADO ────────────────────────────────────────────────────
  // La UI y el spec se servían en /docs y /docs-json SIN autenticación,
  // exponiendo públicamente 237 rutas, 309 operaciones y 78 DTOs con nombres
  // de parámetros y reglas de validación (reconocimiento gratis para un
  // atacante). El bloque dependía de `NODE_ENV`, que en Render no está
  // definido, por lo que quedaba activo en producción.
  //
  // Se elimina la ruta por completo en lugar de condicionarla: así no puede
  // reactivarse por una variable de entorno mal configurada.
  //
  // Los decoradores @ApiOperation / @ApiProperty siguen en el código (18
  // archivos) y son inertes: solo son metadata, nadie la lee si no se llama
  // a SwaggerModule.createDocument().
  //
  // Copia local del spec (git-ignorada): .local/api-spec/openapi.json
  // Para regenerarla, reinstaurar temporalmente el bloque en local.
  // ──────────────────────────────────────────────────────────────────────────

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