import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { OrthographyCheckUseCase } from './use-cases/orthography-check.usecase';
import { ProfanityCheckUseCase } from './use-cases/profanity-check.usecase';
import { SanitizerUseCase } from './use-cases/sanitizer.usecase';
import { TrackMetricsUseCase } from './use-cases/track-metrics.usecase';
import { HistoryManagerUseCase } from './use-cases/history-manager.usecase';
import { JelpyAssistantService } from './jelpy-assistant/jelpy-assistant.service';
import { AIResponseBuilder } from './utils/ai-response-builder';
import { IntentDetectorUseCase } from './use-cases/intent-detector.usecase';
import { ChatResponses } from './utils/chat-responses';
import { PublicidadChatService } from '../publicidad-chat/publicidad-chat.service';
import { UsuarioPreferenciasService } from '../preferencias-usuarios/usuario-preferencias.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  /**
   * Memoria ligera en RAM de preferencias por usuario.
   * (No rompe nada de BD; es solo un plus en caliente.)
   */
  private readonly preferenciasPorUsuario = new Map<
    number,
    {
      categorias: Record<number, number>;
      subcategorias: Record<number, number>;
      ciudades: Record<string, number>;
      ultimaBusqueda?: {
        categoriaId?: number;
        subcategoriaId?: number;
        ciudad?: string;
        fecha: Date;
      };
    }
  >();

  constructor(
    private readonly orthographyUseCase: OrthographyCheckUseCase,
    private readonly profanityUseCase: ProfanityCheckUseCase,
    private readonly sanitizerUseCase: SanitizerUseCase,
    private readonly trackMetricsUseCase: TrackMetricsUseCase,
    private readonly historyUseCase: HistoryManagerUseCase,
    private readonly intentDetector: IntentDetectorUseCase,

    @Inject(forwardRef(() => JelpyAssistantService))
    private readonly jelpyAssistant: JelpyAssistantService,

    private readonly publicidadChatService: PublicidadChatService,
    private readonly usuarioPreferenciasService: UsuarioPreferenciasService,
  ) {}

  // ============================================================
  // RECOMENDACIÓN PROACTIVA SUAVE (después de la búsqueda)
  // ============================================================
  private generarRecomendacionProactiva(filtros: any, items: any[]) {
    const f = filtros || {};

    // Si hubo resultados
    if (items.length > 0) {
      // Si ya está en modo promos, no spameamos más
      if (f.promos) return null;

      if (f.subcategoriaId) {
        return '¿Quieres ver promociones relacionadas? 💸';
      }

      if (f.categoriaId) {
        return 'También puedo mostrarte promociones o negocios similares.';
      }

      return 'Si quieres, puedo buscar solo negocios abiertos ahora. 😊';
    }

    // Si NO hubo resultados
    return '¿Quieres que busque algo parecido o en otra ciudad? 🌎';
  }

  // ============================================================
  // ⭐ UPSELL POR HORA DEL DÍA (base)
  // ============================================================
  private obtenerUpsellPorHora(): string {
    const hora = new Date().getHours();

    if (hora >= 6 && hora < 11) {
      return '¿Te gustaría ver lugares para desayunar? 🥞';
    }
    if (hora >= 11 && hora < 15) {
      return 'Hora de comer 🍽️ ¿Quieres opciones cerca de ti?';
    }
    if (hora >= 15 && hora < 19) {
      return '¿Antojo de café o postre? ☕🍰';
    }
    if (hora >= 19 && hora < 24) {
      return 'Perfecto para cenar 🍕 ¿Buscas algo rico?';
    }

    return '¿Quieres ver lugares abiertos 24 horas? 🌙';
  }

  // ============================================================
  // ⭐ APRENDIZAJE DE PREFERENCIAS DEL USUARIO (en memoria)
  // ============================================================
  private actualizarPreferenciasUsuario(
    usuarioId: number | undefined,
    filtros: any,
    items: any[],
  ) {
    if (!usuarioId) return;
    const f = filtros || {};

    let prefs = this.preferenciasPorUsuario.get(usuarioId);
    if (!prefs) {
      prefs = {
        categorias: {},
        subcategorias: {},
        ciudades: {},
      };
      this.preferenciasPorUsuario.set(usuarioId, prefs);
    }

    // Categoría / Subcategoría: primero por filtros detectados
    if (f.categoriaId) {
      const cid = Number(f.categoriaId);
      prefs.categorias[cid] = (prefs.categorias[cid] || 0) + 1;
    }
    if (f.subcategoriaId) {
      const sid = Number(f.subcategoriaId);
      prefs.subcategorias[sid] = (prefs.subcategorias[sid] || 0) + 1;
    }

    // Ciudad detectada
    if (f.ciudad) {
      const ciudad = String(f.ciudad);
      prefs.ciudades[ciudad] = (prefs.ciudades[ciudad] || 0) + 1;
    }

    // Si no hubo filtros, intentar inferir de los resultados
    if (!f.categoriaId && items.length > 0) {
      const cid = Number(items[0].categoria_id || items[0].categoriaId);
      if (!isNaN(cid)) {
        prefs.categorias[cid] = (prefs.categorias[cid] || 0) + 1;
      }
    }

    if (!f.subcategoriaId && items.length > 0) {
      const sid = Number(items[0].subcategoria_id || items[0].subcategoriaId);
      if (!isNaN(sid)) {
        prefs.subcategorias[sid] = (prefs.subcategorias?.[sid] || 0) + 1;
      }
    }

    if (!f.ciudad && items.length > 0 && items[0].ciudad) {
      const ciudad = String(items[0].ciudad);
      prefs.ciudades[ciudad] = (prefs.ciudades[ciudad] || 0) + 1;
    }

    prefs.ultimaBusqueda = {
      categoriaId: f.categoriaId,
      subcategoriaId: f.subcategoriaId,
      ciudad: f.ciudad,
      fecha: new Date(),
    };
  }

  // ============================================================
  // ⭐ UPSELL PERSONALIZADO (historial + hora)
  // ============================================================
  private generarUpsellPersonalizado(
    usuarioId: number | undefined,
    filtros: any,
  ): string {
    const upsellHora = this.obtenerUpsellPorHora();

    if (!usuarioId) {
      return upsellHora;
    }

    const prefs = this.preferenciasPorUsuario.get(usuarioId);
    if (!prefs) {
      return upsellHora;
    }

    const f = filtros || {};

    const topCategoriaId = this.obtenerTopId(prefs.categorias);
    const topSubcategoriaId = this.obtenerTopId(prefs.subcategorias);
    const topCiudad = this.obtenerTopClave(prefs.ciudades);

    // Si hay historial fuerte de comida específica (subcategoría)
    if (topSubcategoriaId && !f.subcategoriaId) {
      return `Sueles buscar mucho esta categoría 🔍 ¿Quieres que te muestre promociones relacionadas?`;
    }

    // Si la ciudad favorita es otra distinta a la actual
    if (topCiudad && f.ciudad && topCiudad !== f.ciudad) {
      return `También sueles buscar en ${topCiudad}. ¿Quieres que te muestre opciones ahí? 🌎`;
    }

    // Si tiene categoría favorita distinta
    if (topCategoriaId && f.categoriaId && topCategoriaId !== f.categoriaId) {
      return 'También puedo mostrarte algo de tus categorías favoritas. 😉';
    }

    // Si no hay nada muy claro, regresamos el upsell por hora
    return upsellHora;
  }

  private obtenerTopId(map: Record<number, number>): number | null {
    const entries = Object.entries(map || {});
    if (!entries.length) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return Number(entries[0][0]);
  }

  private obtenerTopClave(map: Record<string, number>): string | null {
    const entries = Object.entries(map || {});
    if (!entries.length) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }

  // ============================================================
  // ⭐ MENSAJE CONTEXTUAL (fin de semana / temporada)
  // ============================================================
  private generarMensajeContextual(ciudad?: string): string | null {
    const now = new Date();
    const mes = now.getMonth(); // 0-11
    const diaSemana = now.getDay(); // 0 = domingo
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6;

    // Navidad / Año nuevo
    if (mes === 11 || mes === 0) {
      return 'Es temporada navideña ✨ Algunos lugares pueden tener menús especiales o horarios distintos.';
    }

    // Verano (junio, julio, agosto)
    if (mes >= 5 && mes <= 7) {
      return 'En temporada de calor muchos lugares se llenan rápido 🥵. Te conviene revisar opciones con reservación.';
    }

    if (esFinDeSemana) {
      return 'Es fin de semana 🎉 Algunos negocios pueden estar más llenos de lo normal. Te recomiendo revisar horarios y promociones.';
    }

    if (ciudad) {
      return `Buscando en ${ciudad}. Si quieres, luego puedo sugerirte otras ciudades cercanas.`;
    }

    return null;
  }

  // ============================================================
  // PROCESAR MENSAJE DEL USUARIO
  // ============================================================
  async processUserMessage(
    input: string,
    usuarioId?: number,
    contexto?: {
      ip?: string;
      userAgent?: string;
      latitud?: number;
      longitud?: number;
      ciudad?: string;
    },
  ) {
    this.logger.debug(`Procesando mensaje: "${input}"`);
  
    const latitud = contexto?.latitud ?? null;
    const longitud = contexto?.longitud ?? null;
    const ciudad = contexto?.ciudad ?? null;
  
    // ============================================================
    // SANEAR + CORREGIR
    // ============================================================
    const textoLimpio = this.sanitizerUseCase.execute(input);
    const textoCorregido = await this.orthographyUseCase.execute(textoLimpio);
  
    // ============================================================
    // MODERACIÓN
    // ============================================================
    const moderacion = await this.profanityUseCase.execute(
      textoLimpio,
      textoCorregido,
      {
        ip: contexto?.ip ?? null,
        userAgent: contexto?.userAgent ?? null,
        usuarioId: usuarioId ?? null,
      },
    );
  
    // ❌ GROSERÍA — BLOQUEO
    if (!moderacion.permitido) {
      return {
        status: 'rechazado',
        motivo: moderacion.motivo,
        groseria: moderacion.palabra,
      };
    }
  
    // ⚠️ Advertencia sin bloqueo
    if (moderacion.advertencia === 'mantener_respecto') {
      return {
        status: 'advertencia',
        mensajeOriginal: input,
        respuesta: { titulo: 'Por favor mantén un lenguaje respetuoso.' },
      };
    }
  
    // ============================================================
    // DETECTOR — CHAT CASUAL
    // ============================================================
    const intent = this.intentDetector.detect(textoCorregido);
  
    if (intent === 'chat') {
      const respuesta = ChatResponses.responder(textoCorregido);
  
      return {
        status: 'chat',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        respuesta,
      };
    }
  
    // ============================================================
    // HISTORIAL SOLO PARA BÚSQUEDA
    // ============================================================
    await this.historyUseCase.saveQuery(usuarioId ?? 0, textoCorregido);
  
    // ============================================================
    // INTERPRETACIÓN JELPY — BÚSQUEDA
    // ============================================================
    const interpretacion = await this.jelpyAssistant.interpretar(
      textoCorregido,
      latitud ?? undefined,
      longitud ?? undefined,
      ciudad ?? undefined,
    );
  
    const items = Array.isArray(interpretacion.resultados)
      ? interpretacion.resultados
      : interpretacion.resultados?.items ?? [];
  
    // ============================================================
    // ⭐ APRENDIZAJE REAL (BD) — Registrar preferencia aquí
    // ============================================================
    await this.usuarioPreferenciasService.registrarPreferencia(
      usuarioId ?? 0,
      interpretacion.filtros_detectados?.categoriaId,
      interpretacion.filtros_detectados?.subcategoriaId,
    );
  
    // ============================================================
    // MÉTRICAS POR SUCURSAL
    // ============================================================
    try {
      for (const item of items) {
        const sucursalId =
          item.sucursal_id ||
          item.sucursalId ||
          item.id_sucursal ||
          item.sucursal?.id;
  
        if (sucursalId) {
          await this.trackMetricsUseCase.execute(
            'busqueda',
            'sucursal',
            Number(sucursalId),
          );
        }
      }
    } catch (err) {
      this.logger.error('❌ Error registrando métricas', err);
    }
  
    // ============================================================
    // RESPUESTA BASE AMIGABLE
    // ============================================================
    const friendly: any = AIResponseBuilder.buildFriendlyResponse(
      interpretacion.filtros_detectados,
      items,
    );
  
    // ============================================================
    // ⭐ PUBLICIDAD CONTEXTUAL (respeta tu módulo actual)
    // ============================================================
    try {
      const filtros = interpretacion.filtros_detectados || {};
  
      const publicidadActiva = await this.publicidadChatService.obtenerActiva({
        ciudad: filtros.ciudad,
        categoriaId: filtros.categoriaId,
        subcategoriaId: filtros.subcategoriaId,
        texto: textoCorregido,
      });
  
      if (publicidadActiva) {
        friendly.publicidad = {
          id: publicidadActiva.id,
          titulo: publicidadActiva.titulo,
          texto: publicidadActiva.textoPublicitario,
          negocio_id: publicidadActiva.negocioId,
          sucursal_id: publicidadActiva.sucursalId,
          url_destino: publicidadActiva.urlDestino,
          destacado: true,
          nivel_membresia: (publicidadActiva as any).nivelMembresia ?? undefined,
        };
      }
    } catch (err) {
      this.logger.error('❌ Error obteniendo publicidad', err);
    }
  
    // ============================================================
    // ⭐ APRENDIZAJE EN RAM + UPSSELL
    // ============================================================
    this.actualizarPreferenciasUsuario(
      usuarioId,
      interpretacion.filtros_detectados,
      items,
    );
  
    const recomendacion = this.generarRecomendacionProactiva(
      interpretacion.filtros_detectados,
      items,
    );
  
    if (recomendacion) {
      friendly.recomendacion = recomendacion;
    }
  
    const upsell = this.generarUpsellPersonalizado(
      usuarioId,
      interpretacion.filtros_detectados,
    );
    if (upsell) {
      friendly.upsell = upsell;
    }
  
    // ============================================================
    // ⭐ CONTEXTO (FIN DE SEMANA / TEMPORADA)
    // ============================================================
    const contextoMsg = this.generarMensajeContextual(
      interpretacion.filtros_detectados?.ciudad,
    );
    if (contextoMsg) {
      friendly.contexto = contextoMsg;
    }
  
    // ============================================================
    // RESPUESTA FINAL
    // ============================================================
    return {
      status: 'aceptado',
      mensajeOriginal: input,
      mensajeCorregido: textoCorregido,
      respuesta: friendly,
      debug: {
        filtros: interpretacion.filtros_detectados,
        totalResultados: items.length,
      },
    };
  }
  

  async interpretQuery(query: string) {
    const limpio = this.sanitizerUseCase.execute(query);
    const corregido = await this.orthographyUseCase.execute(limpio);
    return this.jelpyAssistant.interpretar(corregido);
  }
}
