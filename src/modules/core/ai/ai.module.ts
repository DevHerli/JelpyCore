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
import { ContextResolverUseCase } from './use-cases/context-resolver.usecase';
import { IntentDetectorUseCase } from './use-cases/intent-detector.usecase';

// Entidades
import { UserQueryHistory } from '../metrics/estadistica-historico/entities/user-query-history.entity';

// Módulos externos requeridos
import { ReportesModeracionModule } from '../reports/reportes-moderacion/reportes-moderacion.module';
import { EstadisticasModule } from '../metrics/estadisticas/estadisticas.module';
import { EstadisticaHistoricoModule } from '../metrics/estadistica-historico/estadistica-historico.module';
import { PublicidadChatModule } from '../publicidad-chat/publicidad-chat.module';
import { UsuarioPreferenciasModule } from '../preferencias-usuarios/usuario-preferencias.module';
import { SucursalLikesModule } from '../sucursal-likes/sucursal-likes.module';
import { JelpyAiModule } from '../../jelpy-ai/jelpy-ai.module';

// ← NUEVO: módulo de sesiones de conversación
import { ConversationModule } from '../conversation/conversation.module';

import { ChatResponses } from './utils/chat-responses';
import { SearchCacheService } from './utils/search-cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserQueryHistory]),

    // Conexión circular con Jelpy Assistant
    forwardRef(() => JelpyAssistantModule),

    // Módulos de soporte
    ReportesModeracionModule,
    EstadisticasModule,
    EstadisticaHistoricoModule,
    PublicidadChatModule,
    UsuarioPreferenciasModule,
    SucursalLikesModule,
    JelpyAiModule,

    // ← Memoria conversacional
    ConversationModule,
  ],

  controllers: [AiController],

  providers: [
    AiService,

    // Casos de uso
    OrthographyCheckUseCase,
    ProfanityCheckUseCase,
    SanitizerUseCase,
    TrackMetricsUseCase,
    HistoryManagerUseCase,
    IntentDetectorUseCase,
    ContextResolverUseCase,   // ← NUEVO

    ChatResponses,
    SearchCacheService,
  ],

  exports: [
    AiService,
    OrthographyCheckUseCase,
    ProfanityCheckUseCase,
    SanitizerUseCase,
    TrackMetricsUseCase,
    HistoryManagerUseCase,
    ContextResolverUseCase,   // ← NUEVO
  ],
})
export class AiModule {}
