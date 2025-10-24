import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const serverStartedAt = new Date();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
app.enableCors({
  origin: '*', // o URL del frontend
});

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Configuración de Swagger (sin auth)
  const config = new DocumentBuilder()
    .setTitle('Jelpy Core API')
    .setDescription('Corazón de Jelpy: búsqueda semántica + datos')
    .setVersion('0.1.0')
    // .addBearerAuth()  <-- Desactivado temporalmente para pruebas
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });


  await app.listen(process.env.PORT ?? 3000);

  // const port = process.env.PORT || 3000;
  // await app.listen(port, '0.0.0.0'); 

  // Logger.log(`🚀 Server running on http://0.0.0.0:${port}`, 'Bootstrap');
}

bootstrap();
