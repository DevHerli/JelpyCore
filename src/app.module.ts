import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { TaxonomiaModule } from './modules/catalogos/taxonomia/taxonomia.module';
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

    // Módulos de configuración y utilidades
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
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
        synchronize: false, // PRODUCCIÓN: false (tu DB ya existe)
        timezone: 'Z', // gestionamos TZ en app para "abiertoAhora"
      }),
    }),

    // Módulos del core
    TaxonomiaModule,
    VistaCompletaModule,
    SearchModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
