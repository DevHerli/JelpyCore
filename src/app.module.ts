import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { GuardsModule } from './common/guards/guards.module';
import { CloudinaryModule } from './common/cloudinary/cloudinary.module';

import { TaxonomiaModule } from './modules/core/taxonomia/taxonomia.module';
import { VistaCompletaModule } from './modules/core/vista-completa/vista.module';
import { SearchModule } from './modules/core/search/search.module';
import { HealthModule } from './modules/core/health/health.module';
import { SuscriptoresModule } from './modules/business/suscriptores/suscriptores.module';
import { CiudadesModule } from './modules/catalogos/ciudades/ciudades.module';
import { EspecialidadesModule } from './modules/catalogos/especialidades/especialidades.module';
import { CategoriasModule } from './modules/catalogos/categorias/categorias.module';
import { SubcategoriasModule } from './modules/catalogos/subcategorias/subcategorias.module';
import { JerarquiaModule } from './modules/catalogos/jerarquia-categorias/jerarquia.module';
import { NegociosModule } from './modules/business/negocios/negocios.module';
import { MembresiasModule } from './modules/business/membresias/membresias.module';
import { EstadosModule } from './modules/catalogos/estados/estados.module';
import { SucursalesNegociosModule } from './modules/business/sucursales_negocios/sucursales-negocios.module';
import { HorariosSucursalModule } from './modules/business/horario_sucursal/horarios-sucursal.module';
import { PromocionesSucursalesModule } from './modules/business/promociones_sucursal/promociones-sucursales.module';
import { EstadisticasModule } from './modules/core/metrics/estadisticas/estadisticas.module';
import { EstadisticaHistoricoModule } from './modules/core/metrics/estadistica-historico/estadistica-historico.module';
import { EstadisticasCronModule } from './modules/core/metrics/cron/estadisticas-cron.module';
import { EstadisticasSemanalesModule } from './modules/core/metrics/estadisticas-resumen-semanal/estadisticas-semanales.module';
import { EstadisticasSucursalesHistoricoModule } from './modules/core/metrics/estadisticas-sucursales-historico/estadisticas-sucursales-historico.module';
import { VentasMembresiasModule } from './modules/sales/ventas_membresias/ventas-membresias.module';
import { FiltrosBusquedaModule } from './modules/core/filtros_busqueda/filtros_busqueda.module';
import { JelpyAssistantModule } from './modules/core/ai/jelpy-assistant/jelpy-assistant.module';
import { AiModule } from './modules/core/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { Suscriptor } from './modules/business/suscriptores/entities/suscriptores.entity';
import { CodigoOtp } from './modules/auth/entities/codigo-otp.entity';
import { CaracteristicasSucursalModule } from './modules/business/caracteristicas_sucursales/caracteristicas-sucursal.module';
import { PublicidadChatModule } from './modules/core/publicidad-chat/publicidad-chat.module';
import { UsuarioPreferenciasModule } from './modules/core/preferencias-usuarios/usuario-preferencias.module';
import { SucursalLikesModule } from './modules/core/sucursal-likes/sucursal-likes.module';
import { RankingModule } from './modules/core/ranking/ranking.module';
import { CatalogoProductosModule } from './modules/business/catalogo_productos/catalogo-productos.module';
import { SucursalReviewModule } from './modules/business/sucursales_reviews/sucursal-review.module';
import { BookmarksModule } from './modules/business/bookmark_branch/bookmarks.module';
import { AnunciosModule } from './modules/business/anuncios/anuncios.module';
import { PromocionesNegociosModule } from './modules/business/promociones_negocio/promociones-negocios.module';
import { SuscripcionesModule } from './modules/suscripciones/suscripciones.module';
import { PagosModule } from './modules/pagos/pagos.module';
import { FacturasModule } from './modules/facturas/facturas.module';
import { PostalCodesModule } from './modules/business/domicilios/codigos_postal/postal-codes.module';
import { ColoniasModule } from './modules/business/domicilios/colonias/colonias.module';
import { StreetsModule } from './modules/business/domicilios/calles/streets.module';
import { JelpyAiModule } from './modules/jelpy-ai/jelpy-ai.module';
import { EventosNegociosModule } from './modules/business/eventos_negocios/eventos-negocios.module';
import { SupportModule } from './modules/support/support.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { MessagesModule } from './modules/messages/messages.module';
import { PublicSucursalesModule } from './modules/public/sucursales/public-sucursales.module';
import { PublicAdsModule } from './modules/public/ads/public-ads.module';

@Module({
  imports: [
    SuscriptoresModule,
    CiudadesModule,
    EspecialidadesModule,
    CategoriasModule,
    SubcategoriasModule,
    JerarquiaModule,
    NegociosModule,
    MembresiasModule,
    EstadosModule,
    SucursalesNegociosModule,
    HorariosSucursalModule,
    PromocionesSucursalesModule,
    EstadisticasModule,
    EstadisticasCronModule,
    EstadisticaHistoricoModule,
    EstadisticasSemanalesModule,
    EstadisticasSucursalesHistoricoModule,
    VentasMembresiasModule,
    FiltrosBusquedaModule,
    JelpyAssistantModule,
    AiModule,
    AuthModule,
    CaracteristicasSucursalModule,
    PublicidadChatModule,
    UsuarioPreferenciasModule,
    SucursalLikesModule,
    CatalogoProductosModule,
    RankingModule,
    SucursalReviewModule,
    BookmarksModule,
    AnunciosModule,
    PromocionesNegociosModule,
    SuscripcionesModule,
    PagosModule,
    FacturasModule,
    PostalCodesModule,
    ColoniasModule,
    StreetsModule,
    JelpyAiModule,
    EventosNegociosModule,
    SupportModule,
    NotificacionesModule,
    MessagesModule,
    PublicSucursalesModule,
    PublicAdsModule,

    // Guards globales (JwtAuthGuard + ApiKeyGuard disponibles en toda la app)
    GuardsModule,

    // Cloudinary global (CloudinaryService disponible en toda la app)
    CloudinaryModule,

    // Módulos de configuración y utilidades
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Suscriptor, CodigoOtp]),
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const required = [
          'DB_HOST',
          'DB_USER',
          'DB_PASS',
          'DB_NAME',
          'JWT_SECRET',
          'STRIPE_SECRET_KEY',
          'CLOUDINARY_CLOUD_NAME',
          'CLOUDINARY_API_KEY',
          'CLOUDINARY_API_SECRET',
        ];
        const missing = required.filter(key => !config[key]);
        if (missing.length > 0) {
          throw new Error(
            `\n\n❌ Variables de entorno requeridas no definidas:\n   ${missing.join('\n   ')}\n\nCrea un archivo .env con estas variables antes de iniciar el servidor.\n`,
          );
        }
        return config;
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60, limit: 120 }]),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'mysql',
        host: cfg.get<string>('DB_HOST'),
        port: parseInt(cfg.get<string>('DB_PORT') || '3306', 10),
        username: cfg.get<string>('DB_USER'),
        password: cfg.get<string>('DB_PASS'),
        database: cfg.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: cfg.get<string>('DB_SYNC') === 'true', // QA: true | PROD: false
        timezone: 'Z', // gestionamos TZ en app para "abiertoAhora"

        // ── Pool de conexiones robusto ─────────────────────────────────────
        // ECONNRESET ocurre cuando el servidor MySQL cierra conexiones idle
        // del pool y TypeORM intenta reutilizarlas sin saber que ya murieron.
        extra: {
          // Tamaño del pool: ajustar según límite de conexiones del plan DB
          connectionLimit: 10,

          // keepAlive envía un ping TCP para mantener la conexión viva
          // y detectar si el servidor la cerró antes de usarla.
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000, // 10 s antes del primer ping

          // Tiempo máximo esperando una conexión libre del pool (ms)
          waitForConnections: true,
          queueLimit: 0,

          // Timeout de conexión inicial (ms)
          connectTimeout: 30000,
        },
      }),
    }),

    // Módulos del core
    TaxonomiaModule,
    VistaCompletaModule,
    SearchModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Rate limiting global — aplica ThrottlerModule.forRoot() a todos los endpoints
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
