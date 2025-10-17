import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Controlador y servicio principal
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

// Módulo del asistente principal
import { JelpyAssistantModule } from './jelpy-assistant/jelpy-assistant.module';

// Casos de uso de IA
import { OrthographyCheckUseCase } from './use-cases/orthography-check.usecase';
import { ProfanityCheckUseCase } from './use-cases/profanity-check.usecase';
import { SanitizerUseCase } from './use-cases/sanitizer.usecase';
import { TrackMetricsUseCase } from './use-cases/track-metrics.usecase';
import { HistoryManagerUseCase } from './use-cases/history-manager.usecase';

// Entidades utilizadas
import { UserQueryHistory } from '../metrics/estadistica-historico/entities/user-query-history.entity';

// Módulos externos requeridos por los use cases
import { ReportesModeracionModule } from '../reports/reportes-moderacion/reportes-moderacion.module';
import { EstadisticasModule } from '../metrics/estadisticas/estadisticas.module';
import { EstadisticaHistoricoModule } from '../metrics/estadistica-historico/estadistica-historico.module';

@Module({
  imports: [
    // Repositorios TypeORM necesarios para los casos de uso
    TypeOrmModule.forFeature([UserQueryHistory]),

    // Conexión circular con Jelpy Assistant
    forwardRef(() => JelpyAssistantModule),

    // Módulos externos (para reportes y estadísticas)
    ReportesModeracionModule,
    EstadisticasModule,
    EstadisticaHistoricoModule,
  ],

  controllers: [AiController],

  providers: [
    AiService,

    // Casos de uso independientes
    OrthographyCheckUseCase,
    ProfanityCheckUseCase,
    SanitizerUseCase,
    TrackMetricsUseCase,
    HistoryManagerUseCase,
  ],

  exports: [
    // Exportar todo lo que otros módulos podrían necesitar
    AiService,
    OrthographyCheckUseCase,
    ProfanityCheckUseCase,
    SanitizerUseCase,
    TrackMetricsUseCase,
    HistoryManagerUseCase,
  ],
})
export class AiModule {}
