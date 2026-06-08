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
import { sugerirCorreccion } from './utils/levenshtein.util';
import { RateLimiterService } from './utils/rate-limiter.service';
import { ZeroResultLoggerUseCase } from './use-cases/zero-result-logger.usecase';
import { JELPY_SEMANTIC_CATEGORIES } from './jelpy-assistant/constants/jelpy-semantic-categories';
import { PublicidadChatService } from '../publicidad-chat/publicidad-chat.service';
import { UsuarioPreferenciasService } from '../preferencias-usuarios/usuario-preferencias.service';
import { SucursalLikesService } from '../sucursal-likes/sucursal-likes.service';
import { JelpyAiService } from '../../jelpy-ai/jelpy-ai.service';
import { ConversationService } from '../conversation/conversation.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

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
    private readonly rateLimiter: RateLimiterService,
    private readonly zeroResultLogger: ZeroResultLoggerUseCase,

    @Inject(forwardRef(() => JelpyAssistantService))
    private readonly jelpyAssistant: JelpyAssistantService,

    private readonly jelpyAiService: JelpyAiService,
    private readonly publicidadChatService: PublicidadChatService,
    private readonly usuarioPreferenciasService: UsuarioPreferenciasService,
    private readonly likesService: SucursalLikesService,
  ) {}

  private normalizarTexto(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[¿?¡!.,;:()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private generarSugerenciasGenericas(ciudad?: string): string[] {
    return [
      ciudad ? `¿Quieres buscar otra cosa en ${ciudad}?` : '¿Quieres hacer otra búsqueda?',
      '¿Quieres buscar algo cerca de ti?',
    ];
  }

  private esSeleccionDeSugerenciaNoConfiable(texto: string): boolean {
    const norm = this.normalizarTexto(texto);

    return (
      norm.startsWith('quieres ver cuales tienen') ||
      norm.startsWith('tambien buscas') ||
      norm.startsWith('buscas el mas cercano') ||
      norm.startsWith('quieres ver los que') ||
      norm.startsWith('quieres ver cuales') ||
      norm.includes('refresco frio') ||
      norm.includes('refrescos frios')
    );
  }

  private generarRecomendacionProactiva(filtros: any, items: any[]): string {
    if (items.length === 0) {
      return 'No encontré opciones exactas 😕 Puedes intentar con otra palabra, giro o ciudad.';
    }

    if (items.some((i) => i.promo)) {
      return 'Algunos resultados pueden tener promociones activas 🎉 Revisa el perfil para más detalles.';
    }

    if (filtros?.subcategoriaId || filtros?.categoriaId) {
      return 'Puedes abrir el perfil de cualquier opción para ver más información.';
    }

    return 'Puedes buscar por negocio, categoría, ciudad o algo cercano a ti.';
  }

  private obtenerUpsellPorHora(): string {
    const hora = new Date().getHours();

    if (hora >= 6 && hora < 11) return 'También puedo ayudarte a buscar desayunos, café o lugares abiertos.';
    if (hora >= 11 && hora < 15) return 'También puedo ayudarte a buscar lugares para comer cerca de ti.';
    if (hora >= 15 && hora < 19) return 'También puedo ayudarte a buscar café, postres o tiendas cercanas.';
    if (hora >= 19 && hora < 24) return 'También puedo ayudarte a buscar opciones para cenar o lugares abiertos.';

    return 'También puedo ayudarte a buscar lugares abiertos o servicios 24 horas.';
  }

  private actualizarPreferenciasUsuario(
    usuarioId: number | undefined,
    filtros: any,
    items: any[],
  ) {
    if (!usuarioId || !items.length) return;

    let prefs = this.preferenciasPorUsuario.get(usuarioId);

    if (!prefs) {
      prefs = { categorias: {}, subcategorias: {}, ciudades: {} };
      this.preferenciasPorUsuario.set(usuarioId, prefs);
    }

    if (filtros?.categoriaId) {
      const id = Number(filtros.categoriaId);
      prefs.categorias[id] = (prefs.categorias[id] || 0) + 1;
    }

    if (filtros?.subcategoriaId) {
      const id = Number(filtros.subcategoriaId);
      prefs.subcategorias[id] = (prefs.subcategorias[id] || 0) + 1;
    }

    if (filtros?.ciudad) {
      prefs.ciudades[filtros.ciudad] = (prefs.ciudades[filtros.ciudad] || 0) + 1;
    }

    prefs.ultimaBusqueda = {
      categoriaId: filtros?.categoriaId,
      subcategoriaId: filtros?.subcategoriaId,
      ciudad: filtros?.ciudad,
      fecha: new Date(),
    };
  }

  private generarMensajeContextual(ciudad?: string): string | null {
    if (ciudad) return `Buscando en ${ciudad}.`;
    return null;
  }

  async processUserMessage(
    input: string,
    usuarioId?: number,
    contexto?: any,
    sessionId?: string,
  ) {
    this.logger.debug(`[Session: ${sessionId ?? 'nueva'}] Procesando: "${input}"`);

    const claveRL = sessionId ?? contexto?.ip ?? 'anonymous';

    if (!this.rateLimiter.verificar(claveRL)) {
      const segundos = this.rateLimiter.tiempoRestante(claveRL);

      return {
        sessionId: sessionId ?? 'sin-sesion',
        status: 'rate_limited',
        mensajeOriginal: input,
        mensajeCorregido: input,
        respuesta: {
          titulo: 'Demasiados mensajes 🐢',
          mensaje: `Estás enviando muchos mensajes muy rápido. Espera ${segundos} segundo(s) e intenta de nuevo.`,
        },
      };
    }

    this.conversationService.limpiarSesionesViejas().catch(() => null);

    const sesion = await this.conversationService.obtenerOCrearSesion(
      sessionId,
      usuarioId,
      contexto?.ciudad,
    );

    const idSesionActiva = sesion.id;

    const textoLimpio = this.sanitizerUseCase.execute(input);
    const textoCorregido = await this.orthographyUseCase.execute(textoLimpio);

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
          mensaje: 'Detecté lenguaje inapropiado o agresivo. Reformula tu mensaje y con gusto te ayudo.',
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

    if (this.esSeleccionDeSugerenciaNoConfiable(textoCorregido)) {
      const sugerencias = this.generarSugerenciasGenericas(contexto?.ciudad ?? sesion.ciudad);

      await this.conversationService.guardarTurnoUsuario(
        idSesionActiva,
        input,
        'sugerencia_generica',
      );

      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        'Puedo ayudarte con otra búsqueda.',
        {
          intent: 'sugerencia_generica',
          sugerencias,
        },
      );

      return {
        sessionId: idSesionActiva,
        status: 'chat',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        respuesta: {
          titulo: 'Te ayudo',
          mensaje:
            'Para evitar mostrarte resultados incorrectos, dime qué quieres buscar con una frase directa. Por ejemplo: “abarrotes en Tepic”, “farmacias abiertas” o “mariscos cerca de mí”.',
          sugerencias,
        },
      };
    }

    const resolucion = this.contextResolver.execute(textoCorregido, sesion);

    if (resolucion.esSeguimiento && resolucion.referenciaItem) {
      const normalizado = this.normalizarTexto(textoCorregido);

      const respuestaDetalle = this.contextResolver.generarRespuestaDetalle(
        normalizado,
        resolucion.referenciaItem,
      );

      if (respuestaDetalle) {
        await this.conversationService.guardarTurnoUsuario(
          idSesionActiva,
          input,
          'consulta_detalle',
        );

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

    const textoParaProcesar = resolucion.textoEnriquecido;

    const aiIntent = await this.jelpyAiService.interpretar({
      text: textoParaProcesar,
      city_hint: contexto?.ciudad ?? sesion.ciudad ?? null,
      lat: contexto?.latitud ?? null,
      lng: contexto?.longitud ?? null,
      user_id: usuarioId ?? null,
    });

    await this.conversationService.guardarTurnoUsuario(
      idSesionActiva,
      input,
      aiIntent.intent,
    );

    const esBusquedaReal =
      !!aiIntent.entities?.categoria ||
      !!aiIntent.entities?.subcategoria ||
      !!aiIntent.entities?.especialidad ||
      !!aiIntent.normalized_text;

    if (aiIntent.reply?.mode === 'direct_reply' && !esBusquedaReal) {
      const respuestaTexto = aiIntent.reply.message || '';
      const sugerencias = this.generarSugerenciasGenericas(contexto?.ciudad ?? sesion.ciudad);

      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        respuestaTexto,
        { intent: aiIntent.intent, sugerencias },
      );

      return {
        sessionId: idSesionActiva,
        status: aiIntent.intent === 'chat' ? 'chat' : 'recomendacion',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        respuesta: {
          titulo: aiIntent.reply.title,
          mensaje: respuestaTexto,
          sugerencias,
        },
        debug: { aiIntent },
      };
    }

    const textoNormSentimiento = this.normalizarTexto(textoCorregido);

    const esFrustrado = [
      'ya me dijiste',
      'siempre lo mismo',
      'nunca encuentras',
      'no sirve',
      'que malo',
      'pesimo',
      'pésimo',
      'no funciona',
      'inutel',
      'no me ayudas',
      'no encuentras nada',
      'no encuentras',
      'mentira',
      'que inutil',
      'que asco',
      'horrible',
      'no sirves',
    ].some((p) => textoNormSentimiento.includes(this.normalizarTexto(p)));

    if (aiIntent.intent === 'chat' && !esFrustrado) {
      const textoNormCheck = this.normalizarTexto(textoCorregido);

      const tieneTerminoSemantico = JELPY_SEMANTIC_CATEGORIES.some((cat) =>
        cat.aliases.some((alias) =>
          textoNormCheck.includes(this.normalizarTexto(alias)),
        ),
      );

      if (tieneTerminoSemantico) {
        this.logger.debug(
          `[Override] FastAPI dijo "chat" pero hay término semántico → forzando búsqueda`,
        );

        aiIntent.intent = 'buscar_negocios';
      }
    }

    if (aiIntent.intent === 'chat') {
      if (esFrustrado) {
        await this.conversationService.guardarTurnoAsistente(
          idSesionActiva,
          'Entiendo tu frustración, lo siento 😔',
          { intent: 'chat_empatico' },
        );

        return {
          sessionId: idSesionActiva,
          status: 'chat',
          mensajeOriginal: input,
          mensajeCorregido: textoCorregido,
          respuesta: {
            titulo: 'Lo siento',
            mensaje:
              'Entiendo que no encontraste lo que buscabas 😔 Cuéntame qué necesitas con otras palabras y hago mi mejor esfuerzo para ayudarte.',
            sugerencias: this.generarSugerenciasGenericas(contexto?.ciudad ?? sesion.ciudad),
          },
        };
      }

      const historialPrevio =
        await this.conversationService.obtenerHistorial(idSesionActiva);

      const respuestaChat = ChatResponses.responder(textoCorregido, {
        ciudad: contexto?.ciudad ?? sesion.ciudad,
        historialTurnos: historialPrevio.length,
      });

      const sugerencias = this.generarSugerenciasGenericas(contexto?.ciudad ?? sesion.ciudad);

      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        respuestaChat.mensaje,
        { intent: 'chat', sugerencias },
      );

      return {
        sessionId: idSesionActiva,
        status: 'chat',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        respuesta: {
          ...respuestaChat,
          sugerencias,
        },
        debug: { aiIntent },
      };
    }

    await this.historyUseCase.saveQuery(usuarioId ?? 0, textoCorregido);

    const ciudadBusqueda = contexto?.ciudad ?? sesion.ciudad ?? '';
    const cacheKey = `${ciudadBusqueda}:${textoParaProcesar.toLowerCase().trim()}`;

    let interpretacion: any = null;
    const cachedRaw = null;

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

      const itemsCount = interpretacion.resultados?.items?.length ?? 0;

      if (itemsCount > 0) {
        (this.searchCache as any).cache?.set(cacheKey, {
          data: interpretacion,
          expiresAt: Date.now() + 5 * 60 * 1000,
        });

        this.logger.debug(`[Cache SET] ${cacheKey} (${itemsCount} resultados)`);
      }
    }

    const items = Array.isArray(interpretacion.resultados)
      ? interpretacion.resultados
      : interpretacion.resultados?.items ?? [];

    try {
      const sucursalIds = items
        .map((item) =>
          Number(
            item.sucursal_id ||
              item.id_sucursal ||
              item.sucursalId ||
              item.sucursal?.id,
          ),
        )
        .filter((id) => !isNaN(id) && id > 0);

      let likesMap = new Map<number, number>();

      if (sucursalIds.length > 0) {
        likesMap = await this.likesService.contarLikesBatch(sucursalIds);
      }

      for (const item of items) {
        const sid = Number(
          item.sucursal_id ||
            item.id_sucursal ||
            item.sucursalId ||
            item.sucursal?.id,
        );

        item.likes = likesMap.get(sid) ?? 0;

        const tienePromo = item.promo ? 1 : 0;
        const estaAbierto = String(item.abierto ?? '')
          .toLowerCase()
          .includes('abierto')
          ? 1
          : 0;
        const tieneFoto = item.logo_url || item.logo ? 1 : 0;
        const distanciaKm =
          typeof item.distancia_km === 'number' ? item.distancia_km : 999;
        const scoreDistancia =
          distanciaKm > 0 ? Math.max(0, 1 - distanciaKm / 50) : 0;
        const maxLikes = 100;
        const scoreLikes = Math.min(item.likes, maxLikes) / maxLikes;

        item._score =
          scoreLikes * 0.4 +
          tienePromo * 0.25 +
          estaAbierto * 0.2 +
          tieneFoto * 0.1 +
          scoreDistancia * 0.05;
      }

      items.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
    } catch (err) {
      this.logger.error('Error en ranking compuesto', err);
    }

    const negociosContabilizados = new Set<number>();

    for (const item of items) {
      const sucursalId = Number(
        item.sucursal_id ||
          item.id_sucursal ||
          item.sucursalId ||
          item.sucursal?.id,
      );

      if (sucursalId) {
        await this.trackMetricsUseCase.execute(
          'busqueda',
          'sucursal',
          sucursalId,
        );
      }

      const negocioId = Number(
        item.negocio_id || item.negocioId || item.negocio?.id,
      );

      if (negocioId && !negociosContabilizados.has(negocioId)) {
        negociosContabilizados.add(negocioId);

        await this.trackMetricsUseCase.execute(
          'busqueda',
          'negocio',
          negocioId,
        );
      }
    }

    const friendly: any = AIResponseBuilder.buildFriendlyResponse(
      interpretacion.filtros_detectados,
      items,
    );

    if (items.length === 0) {
      const f = interpretacion.filtros_detectados ?? {};

      this.zeroResultLogger
        .execute(textoCorregido, f.ciudad ?? ciudadBusqueda ?? null, {
          categoriaId: f.categoriaId,
          subcategoriaId: f.subcategoriaId,
          intent: aiIntent.intent,
        })
        .catch(() => null);
    }

    if (items.length === 0) {
      const verbosIntento = new Set([
        'quiero',
        'queria',
        'quería',
        'quisiera',
        'quisieras',
        'busco',
        'busca',
        'buscar',
        'buscas',
        'necesito',
        'necesita',
        'necesitas',
        'dame',
        'dime',
        'muestra',
        'muestrame',
        'muéstrame',
        'donde',
        'dónde',
        'como',
        'cómo',
        'para',
        'puedo',
        'puedes',
        'hay',
        'tienen',
        'tiene',
        'existe',
        'existen',
        'poner',
        'conocer',
        'saber',
        'encontrar',
        'ayuda',
        'ayudame',
        'ayúdame',
        'cerca',
        'cerquita',
        'favor',
      ]);

      const palabraSignificativa =
        textoCorregido
          .split(' ')
          .find((w) => w.length >= 4 && !verbosIntento.has(w.toLowerCase())) ??
        null;

      if (palabraSignificativa) {
        const palabraNorm = this.normalizarTexto(palabraSignificativa);

        const yaEnDiccionario = JELPY_SEMANTIC_CATEGORIES.some((cat) =>
          cat.aliases.some((alias) => this.normalizarTexto(alias) === palabraNorm),
        );

        if (!yaEnDiccionario) {
          const correccion = sugerirCorreccion(palabraSignificativa);

          if (
            correccion &&
            this.normalizarTexto(correccion.sugerencia) !== palabraNorm
          ) {
            friendly.quisisteDecir = correccion.sugerencia;
            friendly.mensaje = `No encontré "${palabraSignificativa}" 🤔 ¿Quisiste decir "${correccion.sugerencia}"? Escríbelo para buscarlo.`;
          }
        }
      }
    }

    if (items.length > 0) {
      const friendlyIds = (friendly.items ?? [])
        .map((item: any) =>
          Number(
            item.sucursalId ||
              item.sucursal_id ||
              item.sucursal?.id ||
              item.id,
          ),
        )
        .filter((id: number) => !isNaN(id) && id > 0);

      let batchLikes = new Map<number, number>();

      try {
        batchLikes = await this.likesService.contarLikesBatch(friendlyIds);
      } catch {
        batchLikes = new Map<number, number>();
      }

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
            item.liked = await this.likesService.usuarioHaDadoLike(
              usuarioId,
              sucursalId,
            );
          } catch {
            item.liked = false;
          }
        }

        item.likesCount = batchLikes.get(sucursalId) ?? 0;
      }
    }

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

    await this.conversationService.actualizarContextoBusqueda(
      idSesionActiva,
      aiIntent.intent,
      interpretacion.filtros_detectados,
      items,
      textoCorregido,
    );

    this.actualizarPreferenciasUsuario(
      usuarioId,
      interpretacion.filtros_detectados,
      items,
    );

    if (usuarioId && items.length > 0) {
      const f = interpretacion.filtros_detectados || {};

      this.usuarioPreferenciasService
        .registrarPreferencia(usuarioId, f.categoriaId, f.subcategoriaId)
        .catch(() => null);
    }

    friendly.recomendacion = this.generarRecomendacionProactiva(
      interpretacion.filtros_detectados,
      items,
    );

    friendly.upsell = this.obtenerUpsellPorHora();

    const contextoMsg = this.generarMensajeContextual(
      interpretacion.filtros_detectados?.ciudad,
    );

    if (contextoMsg) friendly.contexto = contextoMsg;

    const sugerencias = this.generarSugerenciasGenericas(
      interpretacion.filtros_detectados?.ciudad ?? ciudadBusqueda,
    );

    friendly.sugerencias = sugerencias;

    await this.conversationService.guardarTurnoAsistente(
      idSesionActiva,
      friendly.mensaje || `Encontré ${items.length} resultado(s).`,
      {
        intent: aiIntent.intent,
        totalResultados: items.length,
        filtros: interpretacion.filtros_detectados,
        sugerencias,
      },
    );

    const horaActual = new Date().getHours();

    if ((horaActual >= 22 || horaActual < 6) && items.length > 0) {
      const horaFmt =
        horaActual === 0
          ? '12am'
          : horaActual < 12
            ? `${horaActual}am`
            : horaActual === 12
              ? '12pm'
              : `${horaActual - 12}pm`;

      friendly.notaHorario = `Son las ${horaFmt} 🌙 — verifica que el lugar esté abierto antes de ir.`;
    }

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

  autocomplete(q: string, ciudad?: string): string[] {
    if (!q || q.trim().length < 2) return [];

    const qNorm = this.normalizarTexto(q.trim());
    const resultados = new Set<string>();

    for (const categoria of JELPY_SEMANTIC_CATEGORIES) {
      for (const alias of categoria.aliases) {
        const aliasNorm = this.normalizarTexto(alias);

        if (aliasNorm.startsWith(qNorm) || aliasNorm.includes(qNorm)) {
          resultados.add(alias);

          if (resultados.size >= 10) break;
        }
      }

      if (resultados.size >= 10) break;
    }

    return [...resultados]
      .sort((a, b) => {
        const aN = this.normalizarTexto(a);
        const bN = this.normalizarTexto(b);
        const aStarts = aN.startsWith(qNorm) ? 0 : 1;
        const bStarts = bN.startsWith(qNorm) ? 0 : 1;

        return aStarts - bStarts || a.length - b.length;
      })
      .slice(0, 6);
  }

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