import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Suscriptor } from '../../modules/business/suscriptores/entities/suscriptores.entity';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiKeyGuard } from './api-key.guard';
import { AdminGuard } from './admin.guard';

/**
 * Módulo global que provee los guards de autenticación comunes.
 * Al ser @Global(), los guards están disponibles en toda la aplicación
 * sin necesidad de importar este módulo en cada feature module.
 *
 * Guards disponibles:
 *  - JwtAuthGuard  → valida Bearer JWT (suscriptores / app móvil)
 *  - ApiKeyGuard   → valida X-API-Key (comunicación inter-backend)
 *  - AdminGuard    → JWT + verifica role='admin' en BD
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Suscriptor]),
  ],
  providers: [JwtAuthGuard, ApiKeyGuard, AdminGuard],
  exports: [JwtAuthGuard, ApiKeyGuard, AdminGuard],
})
export class GuardsModule {}
