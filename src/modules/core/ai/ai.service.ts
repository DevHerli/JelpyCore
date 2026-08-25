import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { OrthographyCheckUseCase } from './use-cases/orthography-check.usecase';
import { ProfanityCheckUseCase } from './use-cases/profanity-check.usecase';
import { SanitizerUseCase } from './use-cases/sanitizer.usecase';
import { TrackMetricsUseCase } from './use-cases/track-metrics.usecase';
import { HistoryManagerUseCase } from './use-cases/history-manager.usecase';
import { ContextResolverUseCase } from './use-cases/context-resolver.usecase';
import { IntentDetectorUseCase } from './use-cases/intent-detector.usecase';
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
import { SugerenciasUtil } from './utils/suggestions.util';
import { ConversationClassifier } from './utils/conversation-classifier';

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
    private readonly intentDetector: IntentDetectorUseCase,
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

  /**
   * Detecta si el texto contiene algún alias de negocio/categoría conocido
   * (JELPY_SEMANTIC_CATEGORIES), usando límites de palabra (\b) en vez de
   * un simple `.includes()`.
   *
   * Bug que esto corrige: con `.includes()` a secas, alias muy cortos como
   * "te" (de "cafeterías") matcheaban como substring dentro de CUALQUIER
   * palabra que los contuviera — ej. "con-TE-stas", "es-TE", "ges-TE-ionar" —
   * lo que forzaba falsos positivos de "esto es una búsqueda de negocio"
   * para mensajes que no tenían nada que ver (como una queja: "porque no
   * contestas bien"). Esto es, con alta probabilidad, la causa raíz de los
   * resultados incoherentes tipo "te recomiendo tal negocio" para mensajes
   * genéricos.
   */
  private contieneTerminoDeNegocio(texto: string): boolean {
    const textoNorm = this.normalizarTexto(texto);

    return JELPY_SEMANTIC_CATEGORIES.some((cat) =>
      cat.aliases.some((alias) => {
        const aliasNorm = this.normalizarTexto(alias);

        // Alias de 1-2 caracteres son demasiado ambiguos para matchear con
        // confianza (ej. "te", "ir"); se ignoran para evitar falsos positivos.
        if (aliasNorm.length < 3) return false;

        const aliasEscapado = aliasNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        return new RegExp(`\\b${aliasEscapado}\\b`).test(textoNorm);
      }),
    );
  }

  async processUserMessage(
    input: string,
    usuarioId?: number,
    contexto?: any,
    sessionId?: string,
  ) {
    // JLP-BULLETPROOF-FIX: red de seguridad de último nivel. Antes, CUALQUIER
    // excepción no controlada dentro del pipeline (DB caída, null pointer,
    // timeout de un servicio externo, lo que sea) se propagaba tal cual hasta
    // el HttpExceptionFilter global como un 500 crudo. El frontend (antes de
    // su propio fix, pendiente de rebuild/redeploy en el celular) solo sabe
    // mostrar el genérico "Lo siento, hubo un problema al interpretar tu
    // mensaje" para CUALQUIER error HTTP, sin distinguir la causa real — por
    // eso "Hola" y cosas tan simples podían verse así.
    //
    // Con esto garantizamos que, pase lo que pase dentro del pipeline, el
    // usuario SIEMPRE reciba una respuesta conversacional coherente (nunca un
    // 500 crudo), mientras el error real queda logueado server-side con
    // stack completo para diagnóstico futuro. Es defensa en profundidad,
    // independiente de si trust-proxy/throttle/rate-limit-key ya cubren la
    // causa raíz conocida — cubre cualquier otra causa no identificada.
    try {
      return await this.processUserMessageInterno(input, usuarioId, contexto, sessionId);
    } catch (error) {
      this.logger.error(
        `[Session: ${sessionId ?? 'sin-sesion'}] Error no controlado procesando "${input}": ${
          error instanceof Error ? error.stack : String(error)
        }`,
      );

      return {
        sessionId: sessionId ?? 'sin-sesion',
        status: 'error_interno',
        mensajeOriginal: input,
        mensajeCorregido: input,
        respuesta: {
          titulo: 'Ups, algo salió mal 🙈',
          mensaje:
            'Tuve un problema para procesar tu mensaje. ¿Puedes intentarlo de nuevo en un momento?',
          sugerencias: ['Promociones', 'Restaurantes', 'Servicios cerca de mí'],
        },
      };
    }
  }

  private async processUserMessageInterno(
    input: string,
    usuarioId?: number,
    contexto?: any,
    sessionId?: string,
  ) {
    this.logger.debug(`[Session: ${sessionId ?? 'nueva'}] Procesando: "${input}"`);

    // JLP-RATELIMIT-KEY-FIX: antes se priorizaba `sessionId` y, si faltaba,
    // `contexto.ip` — pero el frontend nunca envió `sessionId` (bug aparte,
    // corregido en el cliente) y siempre manda `ip: null` explícito en el
    // body. Resultado: `claveRL` caía SIEMPRE en el literal 'anonymous',
    // sin importar el usuario — es decir, el límite "amigable" de 30
    // mensajes/min (RateLimiterService) era en realidad UN SOLO cupo
    // compartido por TODOS los usuarios de la app a la vez. Cualquier
    // actividad normal de varios usuarios simultáneos agotaba ese cupo
    // global y el resto empezaba a recibir "Demasiados mensajes" sin haber
    // enviado casi nada. Usamos `usuarioId` (viene del JWT, siempre
    // presente en este endpoint autenticado) como clave primaria — es
    // estable, único por usuario real y no depende de que el cliente mande
    // nada adicional.
    const claveRL =
      (usuarioId ? `user:${usuarioId}` : null) ??
      (sessionId ? `session:${sessionId}` : null) ??
      (contexto?.ip ? `ip:${contexto.ip}` : null) ??
      'anonymous';

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

    // JLP-CHIP-RECUPERACION-FIX: los chips de recuperación que Jelpy ofrece
    // tras una búsqueda SIN resultados ("¿Quieres intentar con otra
    // palabra?", "¿Buscas algo diferente en {ciudad}?", "¿Quieres ampliar
    // la búsqueda a otra categoría?", "¿Quieres buscar en otra ciudad?" —
    // ver `SugerenciasUtil.generar()`) son preguntas META, no frases de
    // negocio buscables. Deben interceptarse ANTES de
    // `ContextResolverUseCase`/`ConversationClassifier` y responderse con
    // una pregunta dirigida, en vez de intentar una búsqueda con el texto
    // literal del chip (lo que producía "No entendí bien" al tocarlos —
    // justo lo contrario de lo que el chip prometía).
    const chipRecuperacion = ChatResponses.detectarChipRecuperacionSinResultados(textoCorregido);

    if (chipRecuperacion) {
      const respuestaRecuperacion = ChatResponses.responderChipRecuperacion(
        chipRecuperacion,
        contexto?.ciudad ?? sesion.ciudad,
      );
      const sugerenciasRecuperacion = ChatResponses.generarSugerencias('clarificar_busqueda');

      await this.conversationService.guardarTurnoUsuario(idSesionActiva, input, 'chip_recuperacion');
      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        respuestaRecuperacion.mensaje,
        { intent: 'chip_recuperacion', sugerencias: sugerenciasRecuperacion },
      );

      return {
        sessionId: idSesionActiva,
        status: 'chat',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        respuesta: {
          ...respuestaRecuperacion,
          sugerencias: sugerenciasRecuperacion,
        },
      };
    }

    const resolucion = this.contextResolver.execute(textoCorregido, sesion);

    // JLP-CONFIRMACION-PENDIENTE-FIX: si esta resolución consumió una
    // pregunta de confirmación pendiente ("¿Quieres que busque otros
    // negocios similares que sí tengan promo?" -> "Sí"/"No"), se limpia de
    // inmediato para que no siga "viva" en turnos posteriores no
    // relacionados. Se limpia tanto si la respuesta fue afirmativa (ya se
    // va a convertir en una búsqueda real más abajo) como negativa.
    if (resolucion.tipoSeguimiento === 'confirmacion_pendiente') {
      await this.conversationService.guardarPreguntaPendiente(idSesionActiva, null);
    }

    // JLP-CONFIRMACION-PENDIENTE-FIX: respuesta directa cuando el usuario
    // responde "No" a la pregunta de confirmación pendiente — no hay
    // ninguna búsqueda que lanzar, solo confirmar y seguir la charla.
    if (resolucion.respuestaDirecta) {
      await this.conversationService.guardarTurnoUsuario(
        idSesionActiva,
        input,
        'confirmacion_negativa',
      );

      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        resolucion.respuestaDirecta.mensaje,
        { intent: 'confirmacion_negativa' },
      );

      return {
        sessionId: idSesionActiva,
        status: 'chat',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        respuesta: resolucion.respuestaDirecta,
        contextoUsado: true,
      };
    }

    if (resolucion.esSeguimiento && resolucion.referenciaItem) {
      const normalizado = this.normalizarTexto(textoCorregido);

      const respuestaDetalle = this.contextResolver.generarRespuestaDetalle(
        normalizado,
        resolucion.referenciaItem,
      );

      if (respuestaDetalle) {
        // JLP-CONFIRMACION-PENDIENTE-FIX: se registra (o se limpia, si esta
        // respuesta puntual no ofrece ninguna confirmación) cada vez que se
        // genera una respuesta de detalle, para que una pregunta pendiente
        // nunca quede desincronizada con lo último que Jelpy realmente
        // preguntó.
        await this.conversationService.guardarPreguntaPendiente(
          idSesionActiva,
          respuestaDetalle.pendienteConfirmacion ?? null,
        );

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

    // ── FAST-PATH LOCAL (chat) ──────────────────────────────────────────
    // Saludos, agradecimientos, despedidas, quejas, dudas simples, etc. se
    // resuelven 100% localmente vía ChatResponses SIN llamar al microservicio
    // externo de FastAPI (jelpy-ia-service en Render).
    //
    // Por qué: ese servicio corre en un plan gratuito de Render que "duerme"
    // tras inactividad y puede tardar hasta 10s (nuestro timeout) en
    // responder tras un cold start, o simplemente fallar. Antes, CUALQUIER
    // mensaje —incluido un simple "Hola"— dependía por completo de esa
    // llamada: si fallaba, el catch de abajo forzaba `intent: 'buscar_negocios'`
    // a ciegas, lo cual mandaba saludos, promos y quejas al motor de búsqueda
    // (produciendo el error genérico "hubo un problema al interpretar tu
    // mensaje" cuando algo tronaba en el camino, o resultados incoherentes
    // tipo "te recomiendo Salón Simancas" para un mensaje que no tenía nada
    // que ver con eso).
    //
    // Con este fast-path combinamos DOS detectores 100% locales para decidir
    // si el mensaje "suena" a chat conversacional:
    //   1) `IntentDetectorUseCase` — heurística binaria genérica (chat/search).
    //   2) `ChatResponses.detectarIntent()` — catálogo específico de intenciones
    //      conversacionales (saludo, promociones, precio, queja, agendar_cita...).
    // Se combinan con OR porque cada uno cubre casos que el otro no: por
    // ejemplo, `IntentDetectorUseCase` clasifica "promociones"/"promos" como
    // "search" (están en su lista de keywords de negocio), pero ChatResponses
    // SÍ tiene un intent conversacional dedicado para eso ("promociones" →
    // respuesta informativa pidiendo categoría). Si cualquiera de los dos
    // reconoce el mensaje como chat, Y el mensaje no contiene ningún término
    // de negocio/categoría conocido (JELPY_SEMANTIC_CATEGORIES, que sí es la
    // fuente de verdad para búsquedas reales), respondemos directo con
    // ChatResponses: rápido, confiable y sin depender de que FastAPI esté
    // despierto. Si el mensaje sí parece una búsqueda real, seguimos usando
    // FastAPI (para extraer entidades/categoría con más precisión), con el
    // mismo try/catch de siempre como red de seguridad — y si ese falla,
    // usamos la MISMA combinación de heurísticas locales para decidir el
    // fallback en vez de asumir ciegamente que es una búsqueda.
    const clasificacion = ConversationClassifier.classify(textoParaProcesar, {
      hasSearchContext: !!sesion.ultimaQuery,
    });
    const contieneTerminoDeBusqueda = clasificacion.containsBusinessTerm;

    const intentLocalHeuristico = this.intentDetector.detect(textoParaProcesar);
    const intentGranularLocal = clasificacion.chatIntent;

    const pareceChatLocal =
      clasificacion.route === 'chat' ||
      intentLocalHeuristico === 'chat' ||
      intentGranularLocal !== 'fallback';

    let aiIntent: Awaited<ReturnType<JelpyAiService['interpretar']>>;

    if (clasificacion.route === 'clarify') {
      aiIntent = {
        intent: 'chat',
        confidence: clasificacion.confidence,
        entities: {
          categoria: null,
          subcategoria: null,
          ciudad: contexto?.ciudad ?? sesion.ciudad ?? null,
          especialidad: null,
        },
        filters: { abierto_ahora: false, promos: false, cerca_de_mi: false },
        normalized_text: textoParaProcesar,
        reply: { mode: 'local_chat', title: null, message: null, suggestions: [] },
      } as any;
    } else if (clasificacion.route === 'chat' && !contieneTerminoDeBusqueda) {
      aiIntent = {
        intent: 'chat',
        confidence: clasificacion.confidence,
        entities: {
          categoria: null,
          subcategoria: null,
          ciudad: contexto?.ciudad ?? sesion.ciudad ?? null,
          especialidad: null,
        },
        filters: { abierto_ahora: false, promos: false, cerca_de_mi: false },
        normalized_text: textoParaProcesar,
        reply: { mode: 'local_chat', title: null, message: null, suggestions: [] },
      } as any;
    } else {
      try {
        aiIntent = await this.jelpyAiService.interpretar({
          text: textoParaProcesar,
          city_hint: contexto?.ciudad ?? sesion.ciudad ?? null,
          lat: contexto?.latitud ?? null,
          lng: contexto?.longitud ?? null,
          user_id: usuarioId ?? null,
        });
      } catch (error) {
        this.logger.warn(
          `[FastAPI] interpretar() falló, usando fallback degradado: ${
            (error as Error)?.message || error
          }`,
        );

        aiIntent = {
          intent:
            clasificacion.route === 'chat' && !contieneTerminoDeBusqueda
              ? 'chat'
              : 'buscar_negocios',
          confidence: 0,
          entities: {
            categoria: null,
            subcategoria: null,
            ciudad: contexto?.ciudad ?? sesion.ciudad ?? null,
            especialidad: null,
          },
          filters: { abierto_ahora: false, promos: false, cerca_de_mi: false },
          normalized_text: textoParaProcesar,
          reply: { mode: 'search', title: null, message: null, suggestions: [] },
        } as any;
      }
    }

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
      const sugerencias = ChatResponses.generarSugerencias(
        ChatResponses.detectarIntent(textoCorregido),
      );

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
      const tieneTerminoSemantico = this.contieneTerminoDeNegocio(textoCorregido);

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
            // Sin chips aquí a propósito: el usuario está frustrado, no es
            // momento de empujarle más sugerencias/opciones (ver 'queja' en
            // ChatResponses.generarSugerencias).
            sugerencias: ChatResponses.generarSugerencias('queja'),
          },
        };
      }

      // JLP-GUIDED-SEARCH-FIX (Capa 2 — búsqueda guiada): mensaje que NO
      // fue reconocido como ninguna intención conversacional conocida
      // (saludo, gracias, identidad...) NI como búsqueda de negocio, y que
      // tampoco es un simple relleno corto ("???", "ok", "mmm" → esos ya
      // se manejan aparte con chatIntent 'confuso'). Antes esto caía
      // directo en el "No entendí bien, prueba algo como..." genérico y
      // plano de ChatResponses.responder() — informativo pero pasivo. En
      // vez de eso, hacemos una pregunta DIRIGIDA (categoría + ciudad) que
      // le da al usuario un camino claro para continuar, con chips reales
      // de cada categoría para que retomar la conversación sea un solo tap.
      if (clasificacion.route === 'clarify' && clasificacion.chatIntent === 'fallback') {
        const respuestaGuiada = ChatResponses.preguntarAclaracionBusqueda(
          contexto?.ciudad ?? sesion.ciudad,
        );
        const sugerenciasGuiadas = ChatResponses.generarSugerencias('clarificar_busqueda');

        await this.conversationService.guardarTurnoAsistente(
          idSesionActiva,
          respuestaGuiada.mensaje,
          { intent: 'clarificar_busqueda', sugerencias: sugerenciasGuiadas },
        );

        return {
          sessionId: idSesionActiva,
          status: 'chat',
          mensajeOriginal: input,
          mensajeCorregido: textoCorregido,
          respuesta: {
            ...respuestaGuiada,
            sugerencias: sugerenciasGuiadas,
          },
          debug: { aiIntent, clasificacion },
        };
      }

      const historialPrevio =
        await this.conversationService.obtenerHistorial(idSesionActiva);

      // JLP-CHAT-FIX: el turno del usuario actual ya se guardó unas líneas
      // arriba (guardarTurnoUsuario), así que `historialPrevio` SIEMPRE
      // incluye el mensaje que se está procesando ahora mismo. Si contáramos
      // el total de turnos, un "Hola" recién escrito en una sesión nueva ya
      // se vería como "el usuario ya había hablado antes" (historialTurnos=1)
      // y el bot respondería con el tono de "¿en qué más te ayudo?" en vez
      // de un saludo genuino de bienvenida. Contamos solo los turnos donde
      // el ASISTENTE ya respondió antes: eso sí refleja con precisión si
      // esta es la primera interacción real o una continuación.
      const turnosAsistentePrevios = historialPrevio.filter((tn) => tn.rol === 'assistant');
      const ultimoTurnoAsistente = turnosAsistentePrevios[0];
      const ultimaIntencionChat = ultimoTurnoAsistente?.intent;

      const respuestaChat = ChatResponses.responder(textoCorregido, {
        ciudad: contexto?.ciudad ?? sesion.ciudad,
        historialTurnos: turnosAsistentePrevios.length,
        ultimaIntencionChat,
      });

      const intentGranular = ChatResponses.detectarIntent(textoCorregido);

      // Chips dinámicos y contextuales (ver ChatResponses.generarSugerencias):
      // cambian según de qué se habló (saludo, promociones, agendar cita...)
      // y están armados con alias reales de negocio, para que si el usuario
      // toca uno, SIEMPRE se interprete correctamente en el siguiente turno
      // (antes eran 2 preguntas fijas que ni siquiera coincidían con ningún
      // patrón de detección, y tocar el chip devolvía "No entendí bien").
      const sugerencias = ChatResponses.generarSugerencias(intentGranular);

      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        respuestaChat.mensaje,
        { intent: intentGranular, sugerencias },
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
      // JLP-PROMO-FIX: además de verbos de intención genéricos ("quiero",
      // "busco"...), hay que excluir palabras de FILTRO/COMERCIALES
      // (promociones, precio, oferta, cerca, abierto...) de la selección de
      // "palabra significativa" para la sugerencia ortográfica.
      //
      // Bug que esto corrige: con un mensaje como "Promociones de sushi" sin
      // resultados, el código tomaba la primera palabra de ≥4 letras que no
      // fuera un verbo de intención → "Promociones" (en vez de "sushi", que
      // es la categoría real que se buscó). Luego se le pasaba "Promociones"
      // a `sugerirCorreccion()` (fuzzy match por Levenshtein contra el
      // diccionario de negocio), que encontraba "protecciones" como la
      // palabra más parecida — produciendo el mensaje sin sentido
      // "No encontré 'Promociones' ¿Quisiste decir 'protecciones'?" para una
      // categoría (sushi) que sí existe en el diccionario pero simplemente no
      // tuvo resultados en ese momento/ciudad.
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
        // Promociones / ofertas (mismo catálogo conceptual que
        // ChatResponses.PROMO_KEYWORDS — palabras de filtro, no de negocio)
        'promocion',
        'promoción',
        'promociones',
        'promo',
        'promos',
        'oferta',
        'ofertas',
        'descuento',
        'descuentos',
        'rebaja',
        'rebajas',
        'cupon',
        'cupón',
        'cupones',
        // Precio / costo (ChatResponses.PRECIO_KEYWORDS)
        'precio',
        'precios',
        'costo',
        'costos',
        'tarifa',
        'tarifas',
        'cotizacion',
        'cotización',
        // Otros filtros comerciales frecuentes
        'abierto',
        'abierta',
        'abiertos',
        'abiertas',
        'domicilio',
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

    // ── SUGERENCIAS CONTEXTUALES SIN REPETICIÓN ───────────────────────
    // 1. Carga sugerencias ya mostradas en turnos anteriores (historial DB)
    const historialParaSugerencias = await this.conversationService.obtenerHistorial(idSesionActiva);
    const sugerenciasDeHistorial: string[] = historialParaSugerencias
      .filter((t) => t.rol === 'assistant' && Array.isArray((t.metadata as any)?.sugerencias))
      .flatMap((t) => (t.metadata as any).sugerencias as string[]);

    // 2. Añadir el texto actual del usuario → la sugerencia tocada nunca reaparece
    //    aunque el sessionId no sea persistente entre requests.
    const yaUsadas = Array.from(new Set([...sugerenciasDeHistorial, input, textoCorregido]));

    // 3. Generar pool contextual según categoría/subcategoría/característica
    const filtrosDetectados = interpretacion.filtros_detectados ?? {};
    const sugerencias = SugerenciasUtil.generar(
      {
        categoriaId:       filtrosDetectados.categoriaId,
        subcategoriaId:    filtrosDetectados.subcategoriaId,
        subcategoriaHint:  items[0]?.subcategoria ?? filtrosDetectados.subcategoriaHint ?? '',
        categoriaHint:     items[0]?.categoria    ?? filtrosDetectados.categoriaHint    ?? '',
        caracteristica:    filtrosDetectados.caracteristica ?? null,
      },
      items,
      filtrosDetectados.ciudad ?? ciudadBusqueda,
      yaUsadas,
    );

    if (sugerencias.length > 0) friendly.sugerencias = sugerencias;

    await this.conversationService.guardarTurnoAsistente(
      idSesionActiva,
      friendly.mensaje || `Encontré ${items.length} resultado(s).`,
      {
        intent: aiIntent.intent,
        totalResultados: items.length,
        filtros: filtrosDetectados,
        sugerencias,   // se persiste para deduplicar en el próximo turno
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
        clasificacion,
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
