import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
 *
 * Nota: NO se importa TypeOrmModule.forFeature([Suscriptor]) aquí
 * porque ambos guards usan DataSource (global) en lugar de
 * @InjectRepository, evitando UnknownDependenciesException en los
 * módulos consumidores.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [JwtAuthGuard, ApiKeyGuard, AdminGuard],
  exports: [JwtAuthGuard, ApiKeyGuard, AdminGuard],
})
export class GuardsModule {}
