import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import { join } from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';


// Cargar variables de entorno (.env) antes de todo
dotenv.config();


// Marca cuándo se inició el servidor
export const serverStartedAt = new Date();

async function bootstrap() {
  // const app = await NestFactory.create(AppModule);
    const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Seguridad HTTP
  app.use(helmet());

   // Stripe webhook requires raw body
  app.use('/pagos/webhook/stripe', bodyParser.raw({ type: 'application/json' }));

    // Para el resto normal JSON:
  app.use(bodyParser.json({ limit: '2mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));

  // CORS (puedes restringirlo más adelante)
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
  



  // Validaciones globales
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  //Verificar existencia de carpetas locales (solo útil si usas almacenamiento local)
  const uploadPath = join(__dirname, '..', 'uploads', 'negocios', 'logos');
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
    Logger.log(`📂 Carpeta creada automáticamente: ${uploadPath}`, 'Bootstrap');
  }

  // Servir archivos estáticos (si usas almacenamiento local)
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  //Verificación de variables Cloudinary
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    Logger.warn('Cloudinary no está configurado correctamente. Revisa tus variables .env', 'Bootstrap');
  } else {
    Logger.log(`Cloudinary conectado como ${process.env.CLOUDINARY_CLOUD_NAME}`, 'Bootstrap');
  }

  // Swagger sin Auth (temporal)
  const config = new DocumentBuilder()
    .setTitle('Jelpy Core API')
    .setDescription('Corazón de Jelpy: búsqueda semántica + datos')
    .setVersion('0.1.0')
    // .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Levantar servidor
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  const closeApp = async () => {
  console.log('Cerrando servidor...');
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', closeApp);
process.on('SIGINT', closeApp);

  Logger.log(`Servidor corriendo en http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Documentación Swagger: http://localhost:${port}/docs`, 'Swagger');
}

bootstrap();
