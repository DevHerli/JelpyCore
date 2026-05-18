import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { OrthographyCheckUseCase } from './use-cases/orthography-check.usecase';
import { ProfanityCheckUseCase } from './use-cases/profanity-check.usecase';
import { SanitizerUseCase } from './use-cases/sanitizer.usecase';
import { TrackMetricsUseCase } from './use-cases/track-metrics.usecase';
import { HistoryManagerUseCase } from './use-cases/history-manager.usecase';
import { ContextResolverUseCase } from './use-cases/context-resolver.usecase';
import { JelpyAssistantService } from './jelpy-assistant/jelpy-assistant.service';
import { AIResponseBuilder } from './utils/ai-response-builder';
import { ChatResponses } from './utils/chat-responses';
import { SearchCacheService } from './utils/search-cache.service';
import { SugerenciasUtil } from './utils/suggestions.util';
import { PublicidadChatService } from '../publicidad-chat/publicidad-chat.service';
import { UsuarioPreferenciasService } from '../preferencias-usuarios/usuario-preferencias.service';
import { SucursalLikesService } from '../sucursal-likes/sucursal-likes.service';
import { JelpyAiService } from '../../jelpy-ai/jelpy-ai.service';
import { ConversationService } from '../conversation/conversation.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  // Preferencias en RAM (se mantiene para compatibilidad)
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
    private readonly contextResolver: ContextResolverUseCase,
    private readonly conversationService: ConversationService,
    private readonly searchCache: SearchCacheService,

    @Inject(forwardRef(() => JelpyAssistantService))
    private readonly jelpyAssistant: JelpyAssistantService,

    private readonly jelpyAiService: JelpyAiService,
    private readonly publicidadChatService: PublicidadChatService,
    private readonly usuarioPreferenciasService: UsuarioPreferenciasService,
    private readonly likesService: SucursalLikesService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // RECOMENDACIÓN PROACTIVA
  // ─────────────────────────────────────────────────────────────────────
  private generarRecomendacionProactiva(filtros: any, items: any[]): string {
    const f = filtros || {};
    const total = items.length;

    if (total === 0) {
      return 'No encontré opciones exactas 😕 ¿Quieres que busque algo parecido o en otra ciudad? 🌎';
    }

    const itemsConPromo = items.filter((i) => i.promo).length;
    const porcentajePromos = itemsConPromo / total;

    if (itemsConPromo > 0) {
      if (porcentajePromos >= 0.5) {
        return 'Puedo mostrarte también opiniones, horarios o negocios parecidos. ¿Quieres ver más opciones similares? 😊';
      }
      return 'Algunas sucursales tienen promociones activas 🎉 ¿Quieres que te muestre solo las que tienen promo?';
    }

    if (f.subcategoriaId || f.categoriaId) {
      return '¿Quieres ver promociones disponibles en esta categoría? 💸';
    }

    return '¿Quieres ver negocios abiertos ahora cerca de ti? 😊';
  }

  // ─────────────────────────────────────────────────────────────────────
  // UPSELL POR HORA
  // ─────────────────────────────────────────────────────────────────────
  private obtenerUpsellPorHora(): string {
    const hora = new Date().getHours();
    if (hora >= 6 && hora < 11) return '¿Te gustaría ver lugares para desayunar? 🥞';
    if (hora >= 11 && hora < 15) return 'Hora de comer 🍽️ ¿Quieres opciones cerca de ti?';
    if (hora >= 15 && hora < 19) return '¿Antojo de café o postre? ☕🍰';
    if (hora >= 19 && hora < 24) return 'Perfecto para cenar 🍕 ¿Buscas algo rico?';
    return '¿Quieres ver lugares abiertos 24 horas? 🌙';
  }

  // ─────────────────────────────────────────────────────────────────────
  // APRENDIZAJE EN RAM
  // ─────────────────────────────────────────────────────────────────────
  private actualizarPreferenciasUsuario(usuarioId: number | undefined, filtros: any, items: any[]) {
    if (!usuarioId) return;
    let prefs = this.preferenciasPorUsuario.get(usuarioId);
    if (!prefs) {
      prefs = { categorias: {}, subcategorias: {}, ciudades: {} };
      this.preferenciasPorUsuario.set(usuarioId, prefs);
    }
    const f = filtros || {};
    if (f.categoriaId) {
      const cid = Number(f.categoriaId);
      prefs.categorias[cid] = (prefs.categorias[cid] || 0) + 1;
    }
    if (f.subcategoriaId) {
      const sid = Number(f.subcategoriaId);
      prefs.subcategorias[sid] = (prefs.subcategorias[sid] || 0) + 1;
    }
    if (f.ciudad) {
      prefs.ciudades[f.ciudad] = (prefs.ciudades[f.ciudad] || 0) + 1;
    }
    prefs.ultimaBusqueda = {
      categoriaId: f.categoriaId,
      subcategoriaId: f.subcategoriaId,
      ciudad: f.ciudad,
      fecha: new Date(),
    };
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

  // ─────────────────────────────────────────────────────────────────────
  // MENSAJE CONTEXTUAL (estacional / día)
  // ─────────────────────────────────────────────────────────────────────
  private generarMensajeContextual(ciudad?: string): string | null {
    const now = new Date();
    const mes = now.getMonth();
    const dia = now.getDay();
    if (mes === 11 || mes === 0) {
      return 'Es temporada navideña ✨ Algunos lugares pueden tener menús especiales o horarios distintos.';
    }
    if (mes >= 5 && mes <= 7) {
      return 'En temporada de calor muchos lugares se llenan rápido 🥵. Te conviene revisar opciones con reservación.';
    }
    if (dia === 0 || dia === 6) {
      return 'Es fin de semana 🎉 Algunos negocios pueden estar más llenos de lo normal.';
    }
    if (ciudad) return `Buscando en ${ciudad}.`;
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────
  // UPSELL PERSONALIZADO
  // ─────────────────────────────────────────────────────────────────────
  private generarUpsellPersonalizado(usuarioId: number | undefined, filtros: any): string {
    const upsellHora = this.obtenerUpsellPorHora();
    if (!usuarioId) return upsellHora;
    const prefs = this.preferenciasPorUsuario.get(usuarioId);
    if (!prefs) return upsellHora;
    const f = filtros || {};
    const topSubcategoriaId = this.obtenerTopId(prefs.subcategorias);
    const topCiudad = this.obtenerTopClave(prefs.ciudades);
    const topCategoriaId = this.obtenerTopId(prefs.categorias);
    if (topSubcategoriaId && !f.subcategoriaId) {
      return 'Sueles buscar mucho esta categoría 🔍 ¿Quieres ver promociones relacionadas?';
    }
    if (topCiudad && f.ciudad && topCiudad !== f.ciudad) {
      return `También sueles buscar en ${topCiudad}. ¿Quieres opciones ahí? 🌎`;
    }
    if (topCategoriaId && f.categoriaId && topCategoriaId !== f.categoriaId) {
      return 'Puedo mostrarte también algo de tus categorías favoritas 😉';
    }
    return upsellHora;
  }

  // ─────────────────────────────────────────────────────────────────────
  // PROCESS MESSAGE — PIPELINE PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────
  async processUserMessage(
    input: string,
    usuarioId?: number,
    contexto?: any,
    sessionId?: string,
  ) {
    this.logger.debug(`[Session: ${sessionId ?? 'nueva'}] Procesando: "${input}"`);

    // ── Limpieza de sesiones viejas (fire & forget) ──────────────────
    this.conversationService.limpiarSesionesViejas().catch(() => null);

    // ── 1. OBTENER O CREAR SESIÓN ────────────────────────────────────
    const sesion = await this.conversationService.obtenerOCrearSesion(
      sessionId,
      usuarioId,
      contexto?.ciudad,
    );
    const idSesionActiva = sesion.id;

    // ── 2. LIMPIAR Y CORREGIR TEXTO ──────────────────────────────────
    const textoLimpio = this.sanitizerUseCase.execute(input);
    const textoCorregido = await this.orthographyUseCase.execute(textoLimpio);

    // ── 3. MODERACIÓN ────────────────────────────────────────────────
    const moderacion = await this.profanityUseCase.execute(
      textoLimpio,
      textoCorregido,
      {
        ip: contexto?.ip ?? null,
        userAgent: contexto?.userAgent ?? null,
        usuarioId: usuarioId ?? null,
      },
    );

    if (!moderacion.permitido) {
      await this.conversationService.guardarTurnoUsuario(idSesionActiva, input, 'rechazado');
      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        'Detecté lenguaje inapropiado. Por favor reformula tu mensaje.',
        { intent: 'rechazado' },
      );
      return {
        sessionId: idSesionActiva,
        status: 'rechazado',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        motivo: moderacion.motivo,
        respuesta: {
          titulo: 'No puedo procesar ese mensaje',
          mensaje: 'Detecté lenguaje inapropiado o agresivo. Si quieres, reformula tu mensaje y con gusto te ayudo.',
        },
      };
    }

    if (moderacion.advertencia === 'mantener_respecto') {
      await this.conversationService.guardarTurnoUsuario(idSesionActiva, input, 'advertencia');
      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        'Por favor mantén un lenguaje respetuoso.',
        { intent: 'advertencia' },
      );
      return {
        sessionId: idSesionActiva,
        status: 'advertencia',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        respuesta: {
          titulo: 'Por favor mantén un lenguaje respetuoso.',
          mensaje: 'Estoy aquí para ayudarte. Reformula tu mensaje y con gusto continuamos.',
        },
      };
    }

    // ── 4. RESOLVER CONTEXTO DE SESIÓN ──────────────────────────────
    //    ¿El mensaje es una pregunta de seguimiento?
    //    ("¿tiene domicilio?", "el primero", "también en Culiacán")
    const resolucion = this.contextResolver.execute(textoCorregido, sesion);

    if (resolucion.esSeguimiento && resolucion.referenciaItem) {
      // El usuario pregunta algo sobre un resultado anterior — responder directo
      const normalizado = textoCorregido.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const respuestaDetalle = this.contextResolver.generarRespuestaDetalle(
        normalizado,
        resolucion.referenciaItem,
      );

      if (respuestaDetalle) {
        await this.conversationService.guardarTurnoUsuario(idSesionActiva, input, 'consulta_detalle');
        await this.conversationService.guardarTurnoAsistente(
          idSesionActiva,
          respuestaDetalle.mensaje,
          { intent: 'consulta_detalle' },
        );
        return {
          sessionId: idSesionActiva,
          status: 'detalle',
          mensajeOriginal: input,
          mensajeCorregido: textoCorregido,
          respuesta: respuestaDetalle,
          contextoUsado: true,
        };
      }
    }

    // Si es variante de búsqueda, usar el texto enriquecido
    const textoParaProcesar = resolucion.textoEnriquecido;

    // ── 5. FASTAPI DECIDE LA INTENCIÓN ──────────────────────────────
    const aiIntent = await this.jelpyAiService.interpretar({
      text: textoParaProcesar,
      city_hint: contexto?.ciudad ?? sesion.ciudad ?? null,
      lat: contexto?.latitud ?? null,
      lng: contexto?.longitud ?? null,
      user_id: usuarioId ?? null,
    });

    // ── 6. GUARDAR TURNO DEL USUARIO EN SESIÓN ───────────────────────
    await this.conversationService.guardarTurnoUsuario(
      idSesionActiva,
      input,
      aiIntent.intent,
    );

    // ── 7. MODO DIRECT_REPLY (FastAPI responde directo) ──────────────
    const esBusquedaReal =
      !!aiIntent.entities?.categoria ||
      !!aiIntent.entities?.subcategoria ||
      !!aiIntent.entities?.especialidad ||
      !!aiIntent.normalized_text;

    if (aiIntent.reply?.mode === 'direct_reply' && !esBusquedaReal) {
      const respuestaTexto = aiIntent.reply.message || '';
      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        respuestaTexto,
        { intent: aiIntent.intent },
      );
      return {
        sessionId: idSesionActiva,
        status: aiIntent.intent === 'chat' ? 'chat' : 'recomendacion',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        respuesta: {
          titulo: aiIntent.reply.title,
          mensaje: respuestaTexto,
          sugerencias: aiIntent.reply.suggestions ?? [],
        },
        debug: { aiIntent },
      };
    }

    // ── 8. INTENT CHAT (respuestas conversacionales) ─────────────────
    if (aiIntent.intent === 'chat') {
      // Contamos turnos previos para que ChatResponses sepa si ya hubo conversación
      const historialPrevio = await this.conversationService.obtenerHistorial(idSesionActiva);
      const respuestaChat = ChatResponses.responder(textoCorregido, {
        ciudad: contexto?.ciudad ?? sesion.ciudad,
        historialTurnos: historialPrevio.length,
      });

      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        respuestaChat.mensaje,
        { intent: 'chat' },
      );

      return {
        sessionId: idSesionActiva,
        status: 'chat',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        respuesta: respuestaChat,
        debug: { aiIntent },
      };
    }

    // ── 9. BÚSQUEDA REAL (con caché) ─────────────────────────────────
    await this.historyUseCase.saveQuery(usuarioId ?? 0, textoCorregido);

    const ciudadBusqueda = contexto?.ciudad ?? sesion.ciudad ?? '';
    const cacheKey = `${ciudadBusqueda}:${textoParaProcesar.toLowerCase().trim()}`;

    // Intentar hit de caché antes de llamar al asistente completo
    let interpretacion: any = this.searchCache.get<any>(
      ciudadBusqueda, null, null,
    );
    // Usamos la clave de texto como discriminador — caché simple por texto+ciudad
    const cachedRaw = (this.searchCache as any).cache?.get(cacheKey);
    if (cachedRaw && Date.now() < cachedRaw.expiresAt) {
      interpretacion = cachedRaw.data;
      this.logger.debug(`[Cache HIT] ${cacheKey}`);
    } else {
      interpretacion = await this.jelpyAssistant.interpretar(
        textoParaProcesar,
        contexto?.latitud,
        contexto?.longitud,
        ciudadBusqueda,
        usuarioId,
      );
      // Guardar en caché solo si hay resultados
      const itemsCount = interpretacion.resultados?.items?.length ?? 0;
      if (itemsCount > 0) {
        (this.searchCache as any).cache?.set(cacheKey, {
          data: interpretacion,
          expiresAt: Date.now() + 5 * 60 * 1000,   // 5 minutos
        });
        this.logger.debug(`[Cache SET] ${cacheKey} (${itemsCount} resultados)`);
      }
    }

    const items = Array.isArray(interpretacion.resultados)
      ? interpretacion.resultados
      : interpretacion.resultados?.items ?? [];

    // ── 10. LIKES EN BATCH (una sola query) ───────────────────────────
    try {
      const sucursalIds = items
        .map((item) => Number(item.sucursal_id || item.id_sucursal || item.sucursalId || item.sucursal?.id))
        .filter((id) => !isNaN(id) && id > 0);

      if (sucursalIds.length > 0) {
        const likesMap = await this.likesService.contarLikesBatch(sucursalIds);
        for (const item of items) {
          const sid = Number(item.sucursal_id || item.id_sucursal || item.sucursalId || item.sucursal?.id);
          item.likes = likesMap.get(sid) ?? 0;
        }
        items.sort((a, b) => (b.likes || 0) - (a.likes || 0));
      }
    } catch (err) {
      this.logger.error('Error obteniendo likes en batch', err);
    }

    // ── 11. MÉTRICAS ─────────────────────────────────────────────────
    for (const item of items) {
      const sucursalId = Number(
        item.sucursal_id || item.id_sucursal || item.sucursalId || item.sucursal?.id,
      );
      if (sucursalId) {
        await this.trackMetricsUseCase.execute('busqueda', 'sucursal', sucursalId);
      }
    }

    // ── 12. CONSTRUIR RESPUESTA ───────────────────────────────────────
    const friendly: any = AIResponseBuilder.buildFriendlyResponse(
      interpretacion.filtros_detectados,
      items,
    );

    // ── 13. LIKES POR ITEM (batch en friendly.items) ──────────────────
    if (items.length > 0) {
      // IDs para batch
      const friendlyIds = (friendly.items ?? []).map((item: any) =>
        Number(item.sucursalId || item.sucursal_id || item.sucursal?.id || item.id),
      ).filter((id: number) => !isNaN(id) && id > 0);

      let batchLikes = new Map<number, number>();
      try {
        batchLikes = await this.likesService.contarLikesBatch(friendlyIds);
      } catch { /* ignorar */ }

      for (const item of friendly.items ?? []) {
        const sucursalId = Number(
          item.sucursalId || item.sucursal_id || item.sucursal?.id || item.id,
        );
        item.likeDisponible = true;
        item.likeAction = {
          endpoint: '/likes/toggle',
          metodo: 'POST',
          payload: { sucursalId, usuarioId: usuarioId ?? null },
        };
        if (usuarioId) {
          try {
            item.liked = await this.likesService.usuarioHaDadoLike(usuarioId, sucursalId);
          } catch { item.liked = false; }
        }
        item.likesCount = batchLikes.get(sucursalId) ?? 0;
      }
    }

    // ── 14. PUBLICIDAD ────────────────────────────────────────────────
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
        };
      }
    } catch (err) {
      this.logger.error('Error obteniendo publicidad', err);
    }

    // ── 15. GUARDAR CONTEXTO EN SESIÓN ────────────────────────────────
    await this.conversationService.actualizarContextoBusqueda(
      idSesionActiva,
      aiIntent.intent,
      interpretacion.filtros_detectados,
      items,
      textoCorregido,
    );

    await this.conversationService.guardarTurnoAsistente(
      idSesionActiva,
      friendly.mensaje || `Encontré ${items.length} resultado(s).`,
      {
        intent: aiIntent.intent,
        totalResultados: items.length,
        filtros: interpretacion.filtros_detectados,
      },
    );

    // ── 16. APRENDIZAJE + RECOMENDACIÓN + UPSELL + CONTEXTO ──────────
    this.actualizarPreferenciasUsuario(usuarioId, interpretacion.filtros_detectados, items);

    // Guardar preferencias en DB (fire & forget)
    if (usuarioId && items.length > 0) {
      const f = interpretacion.filtros_detectados || {};
      this.usuarioPreferenciasService
        .registrarPreferencia(usuarioId, f.categoriaId, f.subcategoriaId)
        .catch(() => null);
    }

    const recomendacion = this.generarRecomendacionProactiva(interpretacion.filtros_detectados, items);
    if (recomendacion) friendly.recomendacion = recomendacion;

    const upsell = this.generarUpsellPersonalizado(usuarioId, interpretacion.filtros_detectados);
    if (upsell) friendly.upsell = upsell;

    const contextoMsg = this.generarMensajeContextual(interpretacion.filtros_detectados?.ciudad);
    if (contextoMsg) friendly.contexto = contextoMsg;

    // Sugerencias contextuales inteligentes
    const sugerencias = SugerenciasUtil.generar(
      interpretacion.filtros_detectados ?? {},
      items,
      interpretacion.filtros_detectados?.ciudad ?? ciudadBusqueda,
    );
    if (sugerencias.length > 0) friendly.sugerencias = sugerencias;

    // ── 17. RETURN FINAL ──────────────────────────────────────────────
    return {
      sessionId: idSesionActiva,
      status: 'aceptado',
      mensajeOriginal: input,
      mensajeCorregido: textoCorregido,
      respuesta: friendly,
      debug: {
        aiIntent,
        filtros: interpretacion.filtros_detectados,
        totalResultados: items.length,
        sesionActiva: idSesionActiva,
        esSeguimiento: resolucion.esSeguimiento,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // INTERPRETAR QUERY (sin pipeline completo, sin sesión)
  // ─────────────────────────────────────────────────────────────────────
  async interpretQuery(query: string) {
    const limpio = this.sanitizerUseCase.execute(query);
    const corregido = await this.orthographyUseCase.execute(limpio);
    return this.jelpyAiService.interpretar({
      text: corregido,
      city_hint: null,
      lat: null,
      lng: null,
      user_id: null,
    });
  }
}
