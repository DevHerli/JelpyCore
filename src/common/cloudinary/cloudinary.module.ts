import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryService } from './cloudinary.service';

/**
 * Módulo global: CloudinaryService disponible en toda la aplicación
 * sin necesidad de importar este módulo en cada feature module.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
