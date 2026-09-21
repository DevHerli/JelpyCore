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
import { SearchTrendLoggerUseCase } from './use-cases/search-trend-logger.usecase';
import { JELPY_SEMANTIC_CATEGORIES } from './jelpy-assistant/constants/jelpy-semantic-categories';
import { coincideTerminoDeNegocio } from './utils/business-term-matcher.util';
import { PublicidadChatService } from '../publicidad-chat/publicidad-chat.service';
import { UsuarioPreferenciasService } from '../preferencias-usuarios/usuario-preferencias.service';
import { SucursalLikesService } from '../sucursal-likes/sucursal-likes.service';
import { JelpyAiService } from '../../jelpy-ai/jelpy-ai.service';
import { ConversationService } from '../conversation/conversation.service';
import { ConversationClassifier } from './utils/conversation-classifier';
import { SocialQueryNormalizer } from './utils/social-query-normalizer';
import { SafetyPolicy } from './utils/safety-policy';
import { PromocionesSucursalesService } from '../../business/promociones_sucursal/promociones-sucursales.service';

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
    private readonly searchTrendLogger: SearchTrendLoggerUseCase,

    @Inject(forwardRef(() => JelpyAssistantService))
    private readonly jelpyAssistant: JelpyAssistantService,

    private readonly jelpyAiService: JelpyAiService,
    private readonly publicidadChatService: PublicidadChatService,
    private readonly promocionesSucursalesService: PromocionesSucursalesService,
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

    // JLP-ESPECIALIDAD-BUSQUEDA-FIX: al igual que en
    // `ConversationClassifier.contieneTerminoDeNegocio`, este método solo
    // revisaba `cat.aliases` (palabras sombrilla como "doctor", "clinica"),
    // nunca `cat.servicios` (nombres reales de especialidad/servicio, ej.
    // "Traumatología", "pediatra"). Eso hacía que el override de la línea
    // ~892 ("FastAPI dijo chat pero hay término semántico → forzar
    // búsqueda") nunca se activara para una especialidad médica mencionada
    // sola (sin "doctor"/"médico" al lado, ej. "trauma", "traumatologo"),
    // dejando la respuesta de FastAPI en "chat" tal cual. Ahora también se
    // revisan los `servicios` de cada categoría.
    //
    // JLP-CONECTOR-OPCIONAL-FIX: `coincideTerminoDeNegocio` (helper
    // compartido con `ConversationClassifier`) además tolera que el usuario
    // omita conectores gramaticales dentro de alias/servicios de varias
    // palabras (ej. "corte pelo" reconoce el alias "corte de pelo") — ver
    // el comentario de ese archivo para el bug exacto que esto corrige.
    return JELPY_SEMANTIC_CATEGORIES.some((cat) =>
      [...cat.aliases, ...(cat.servicios || [])].some((termino) =>
        coincideTerminoDeNegocio(textoNorm, this.normalizarTexto(termino)),
      ),
    );
  }

  private registrarTendenciaBusqueda(params: {
    usuarioId?: number;
    sessionId?: string;
    queryOriginal: string;
    queryNormalizada: string;
    textoCorregido: string;
    ciudadBusqueda?: string | null;
    contexto?: any;
    aiIntent?: any;
    interpretacion?: any;
    items: any[];
  }): void {
    const filtros = params.interpretacion?.filtros_detectados ?? {};
    const primerItem = params.items[0] ?? {};
    const entities = params.aiIntent?.entities ?? {};

    this.searchTrendLogger
      .execute({
        usuarioId: params.usuarioId ?? null,
        sessionId: params.sessionId ?? null,
        queryOriginal: params.queryOriginal,
        queryNormalizada:
          params.aiIntent?.normalized_text ??
          params.queryNormalizada ??
          params.textoCorregido,
        ciudad:
          filtros.ciudad ??
          entities.ciudad ??
          params.ciudadBusqueda ??
          params.contexto?.ciudad ??
          null,
        categoriaId: filtros.categoriaId ?? filtros.categoria_id ?? null,
        subcategoriaId: filtros.subcategoriaId ?? filtros.subcategoria_id ?? null,
        especialidadId: filtros.especialidadId ?? filtros.especialidad_id ?? null,
        categoriaNombre:
          filtros.categoriaNombre ??
          filtros.categoria ??
          entities.categoria ??
          primerItem.categoria ??
          primerItem.categoria_nombre ??
          null,
        subcategoriaNombre:
          filtros.subcategoriaNombre ??
          filtros.subcategoria ??
          entities.subcategoria ??
          primerItem.subcategoria ??
          primerItem.subcategoria_nombre ??
          null,
        especialidadNombre:
          filtros.especialidadNombre ??
          filtros.especialidad ??
          entities.especialidad ??
          primerItem.especialidad ??
          primerItem.especialidad_nombre ??
          null,
        intent: params.aiIntent?.intent ?? filtros.intent ?? null,
        totalResultados: params.items.length,
        sinResultados: params.items.length === 0,
        lat: params.contexto?.latitud ?? null,
        lng: params.contexto?.longitud ?? null,
      })
      .catch(() => null);
  }

  private esSolicitudPromosGenerales(texto: string, aiIntent?: any): boolean {
    const textoNorm = this.normalizarTexto(texto);
    const mencionaPromo = this.mencionaPromociones(textoNorm);

    if (!mencionaPromo) return false;

    const tieneEntidadEspecifica =
      !!aiIntent?.entities?.categoria ||
      !!aiIntent?.entities?.subcategoria ||
      !!aiIntent?.entities?.especialidad ||
      this.contieneTerminoDeNegocio(texto);

    return !tieneEntidadEspecifica;
  }

  private mencionaPromociones(texto: string): boolean {
    const textoNorm = this.normalizarTexto(texto);

    return /\b(promo|promos|promocion|promociones|oferta|ofertas|descuento|descuentos|rebaja|rebajas|cupon|cupones|2x1)\b/.test(textoNorm);
  }

  private extraerTextoFiltroPromocion(texto: string, ciudad?: string | null): string | null {
    const ciudadNorm = ciudad ? this.normalizarTexto(ciudad) : '';
    let limpio = this.normalizarTexto(texto)
      .replace(/\b(promociones|promocion|promos|promo|ofertas|oferta|descuentos|descuento|activas|activa|disponibles|disponible|vigentes|vigente|dame|quiero|busco|buscame|muéstrame|muestrame|muestra|de|en|para|con)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (ciudadNorm) {
      limpio = limpio
        .replace(new RegExp(`\\b${ciudadNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return limpio.length >= 3 ? limpio : null;
  }

  private obtenerFiltrosPromocionAlternos(filtroTexto: string): string[] {
    const filtroNorm = this.normalizarTexto(filtroTexto);
    const filtros = new Set<string>([filtroTexto.trim()]);

    const gruposSinonimos: Array<{ patrones: RegExp[]; terminos: string[] }> = [
      {
        patrones: [
          /\b(chela|chelas|chelita|chelitas|cheve|cheves|cheva|chevas|cerveza|cervezas|caguama|caguamas|kaguama|kaguamas|caguamita|caguamitas|kaguamita|kaguamitas|kiwa|kiwas|kiwi|kiwis|kiki|kikis|kiwasaki|kiwasakis|michelada|micheladas|chelada|cheladas|fria|frias|fría|frías|amargosa|amargosas)\b/,
        ],
        terminos: [
          'cerveza',
          'cervezas',
          'chela',
          'chelas',
          'cheve',
          'cheves',
          'caguama',
          'caguamas',
          'caguamitas',
          'kaguamitas',
          'kiwas',
          'kiwis',
          'kikis',
          'michelada',
          'micheladas',
          'frias',
          'frías',
          'amargosas',
          'bebidas alcoholicas',
          'bebidas alcohólicas',
        ],
      },
      {
        patrones: [/\b(alita|alitas|wings|boneless)\b/],
        terminos: ['alitas', 'alita', 'wings', 'boneless'],
      },
      {
        patrones: [/\b(sushi|rollo|rollos|makis|maki)\b/],
        terminos: ['sushi', 'rollo', 'rollos', 'maki', 'makis'],
      },
    ];

    for (const grupo of gruposSinonimos) {
      if (grupo.patrones.some((patron) => patron.test(filtroNorm))) {
        grupo.terminos.forEach((termino) => filtros.add(termino));
      }
    }

    return Array.from(filtros).filter((filtro) => filtro.length >= 3);
  }

  private detectarItemCatalogoAmbiguo(texto: string): string | null {
    const textoNorm = this.normalizarTexto(texto);

    if (!textoNorm) return null;

    const yaTieneAccion =
      this.mencionaPromociones(textoNorm) ||
      /\b(donde|dónde|venden|vende|vendan|venta|encuentro|encontrar|consigo|tienen|tiene|hay|hacen|hace|lugares|lugar|negocios|negocio|cerca)\b/.test(textoNorm);

    if (yaTieneAccion) return null;

    const mapaItems: Array<{ item: string; patrones: string[] }> = [
      { item: 'alitas', patrones: ['alitas', 'alita'] },
      { item: 'tamales', patrones: ['tamales', 'tamal'] },
      { item: 'pozole', patrones: ['pozole'] },
      { item: 'helados', patrones: ['helados', 'helado', 'nieves', 'nieve'] },
      { item: 'rollos mar y tierra', patrones: ['rollos mar y tierra', 'rollos mar tierra', 'rollo mar y tierra', 'rollo mar tierra'] },
    ];

    const coincidencia = mapaItems.find(({ patrones }) =>
      patrones.some((patron) => textoNorm === patron),
    );

    return coincidencia?.item ?? null;
  }

  private extraerItemBusquedaCatalogo(texto: string, ciudad?: string | null): string | null {
    const textoNorm = this.normalizarTexto(texto);
    const ciudadNorm = ciudad ? this.normalizarTexto(ciudad) : '';

    const match = textoNorm.match(
      /\b(?:donde|dónde|en donde|venden|vende|vendan|encuentro|encontrar|consigo|tienen|tiene|hay|muestrame|muéstrame|mostrar|lugares|negocios)\b(?:\s+\w+){0,4}?\s+\b(?:venden|vende|vendan|encuentro|encontrar|consigo|tienen|tiene|hay)?\s*(.+)$/,
    );

    let candidato = (match?.[1] ?? textoNorm)
      .replace(/\b(donde|dónde|en|venden|vende|vendan|encuentro|encontrar|consigo|tienen|tiene|hay|muestrame|muéstrame|mostrar|lugares|lugar|negocios|negocio|cerca|de|mi|porfa|favor)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (ciudadNorm) {
      candidato = candidato
        .replace(new RegExp(`\\b${ciudadNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return candidato.length >= 3 ? candidato : null;
  }

  private async responderItemCatalogoAmbiguo(params: {
    input: string;
    textoCorregido: string;
    sessionId: string;
    item: string;
    contexto?: any;
    ciudad?: string | null;
  }): Promise<any> {
    const mensaje =
      `Te ayudo con ${params.item}. ¿Quieres que te muestre lugares donde venden ${params.item} o promociones de ${params.item}?`;

    await this.conversationService.guardarPreguntaPendiente(params.sessionId, {
      tipo: 'catalogo_item_accion',
      categoria: params.item,
      ciudad: params.contexto?.ciudad ?? params.ciudad ?? undefined,
    });

    await this.conversationService.guardarTurnoUsuario(
      params.sessionId,
      params.input,
      'catalogo_item_ambiguo',
    );

    await this.conversationService.guardarTurnoAsistente(
      params.sessionId,
      mensaje,
      { intent: 'catalogo_item_ambiguo', sugerencias: [] },
    );

    return {
      sessionId: params.sessionId,
      status: 'chat',
      mensajeOriginal: params.input,
      mensajeCorregido: params.textoCorregido,
      respuesta: {
        titulo: `¿Lugares o promociones de ${params.item}?`,
        mensaje,
        items: [],
        sugerencias: [],
        seguimiento: '',
      },
      debug: {
        aiIntent: { intent: 'catalogo_item_ambiguo', source: 'local_catalogo_item' },
      },
    };
  }

  private async responderPromocionesGenerales(params: {
    input: string;
    textoCorregido: string;
    textoParaProcesar: string;
    sessionId: string;
    usuarioId?: number;
    contexto?: any;
  }): Promise<any> {
    const mensaje =
      'Claro. ¿Qué tipo de promociones te gustaría encontrar? Puedes decirme, por ejemplo: promociones de sushi, alitas, farmacias, tiendas, belleza o servicios.';

    await this.conversationService.guardarPreguntaPendiente(params.sessionId, {
      tipo: 'promociones_categoria',
      ciudad: params.contexto?.ciudad ?? undefined,
    });

    await this.conversationService.guardarTurnoAsistente(
      params.sessionId,
      mensaje,
      {
        intent: 'buscar_promociones',
        totalResultados: 0,
        sugerencias: [],
      },
    );

    this.searchTrendLogger
      .execute({
        usuarioId: params.usuarioId ?? null,
        sessionId: params.sessionId,
        queryOriginal: params.input,
        queryNormalizada: params.textoParaProcesar,
        ciudad: params.contexto?.ciudad ?? null,
        categoriaNombre: 'promociones',
        intent: 'buscar_promociones',
        totalResultados: 0,
        sinResultados: false,
        lat: params.contexto?.latitud ?? null,
        lng: params.contexto?.longitud ?? null,
      })
      .catch(() => null);

    return {
      sessionId: params.sessionId,
      status: 'chat',
      mensajeOriginal: params.input,
      mensajeCorregido: params.textoCorregido,
      respuesta: {
        titulo: 'Promociones',
        mensaje,
        items: [],
        sugerencias: [],
        seguimiento: '',
      },
      debug: {
        aiIntent: { intent: 'buscar_promociones', source: 'local_promos_generales' },
        totalResultados: 0,
      },
    };
  }

  private async responderPromocionesFiltradas(params: {
    input: string;
    textoCorregido: string;
    textoParaProcesar: string;
    sessionId: string;
    filtroTexto: string;
    usuarioId?: number;
    contexto?: any;
  }): Promise<any> {
    const promocionesPorId = new Map<number, any>();

    for (const filtro of this.obtenerFiltrosPromocionAlternos(params.filtroTexto)) {
      const promocionesEncontradas =
        await this.promocionesSucursalesService.buscarPromocionesActivasPorTexto(filtro);

      (promocionesEncontradas ?? []).forEach((promo) =>
        promocionesPorId.set(Number(promo.id), promo),
      );

      if (promocionesPorId.size > 0) break;
    }

    const promociones = Array.from(promocionesPorId.values()).slice(0, 10);

    const items = promociones.map((promo) => ({
      id: promo.id,
      titulo: promo.titulo,
      descripcion: promo.descripcion ?? null,
      tipoPromocion: promo.tipoPromocion,
      valorDescuento: promo.valorDescuento ?? null,
      fechaInicio: promo.fechaInicio,
      fechaFin: promo.fechaFin,
      imagenUrl: promo.imagenUrl ?? null,
      sucursalId: promo.sucursal?.id ?? null,
      sucursal: promo.sucursal?.nombreSucursal ?? null,
      negocio: promo.sucursal?.negocio?.nombreNegocio ?? null,
      ciudad: promo.sucursal?.ciudad?.nombre ?? null,
    }));

    const mensajeBase = items.length
      ? items.length === 1
        ? `Encontré esta promoción activa para ${params.filtroTexto}:`
        : `Encontré ${items.length} promociones activas para ${params.filtroTexto}:`
      : `Por ahora no encontré promociones activas para ${params.filtroTexto}. Si quieres, también puedo mostrarte lugares donde venden ${params.filtroTexto}.`;

    const mensaje = mensajeBase;
    const preguntaSeguimiento = items.length
      ? '¿Quieres buscar promociones de otra categoría?'
      : `¿Te muestro lugares donde venden ${params.filtroTexto}?`;

    this.searchTrendLogger
      .execute({
        usuarioId: params.usuarioId ?? null,
        sessionId: params.sessionId,
        queryOriginal: params.input,
        queryNormalizada: params.textoParaProcesar,
        ciudad: params.contexto?.ciudad ?? null,
        categoriaNombre: params.filtroTexto,
        intent: 'buscar_promociones',
        totalResultados: items.length,
        sinResultados: items.length === 0,
        lat: params.contexto?.latitud ?? null,
        lng: params.contexto?.longitud ?? null,
      })
      .catch(() => null);

    await this.conversationService.guardarTurnoAsistente(
      params.sessionId,
      mensaje,
      {
        intent: 'buscar_promociones',
        totalResultados: items.length,
        sugerencias: [],
      },
    );
    await this.conversationService.guardarPreguntaPendiente(
      params.sessionId,
      items.length
        ? null
        : {
            tipo: 'catalogo_item_accion',
            categoria: params.filtroTexto,
            ciudad: params.contexto?.ciudad ?? undefined,
            accion: 'lugares',
          } as any,
    );

    return {
      sessionId: params.sessionId,
      status: 'aceptado',
      mensajeOriginal: params.input,
      mensajeCorregido: params.textoCorregido,
      respuesta: {
        titulo: items.length ? 'Promociones activas' : 'Sin promociones activas',
        mensaje,
        items,
        sugerencias: [],
        seguimiento: preguntaSeguimiento,
      },
      debug: {
        aiIntent: { intent: 'buscar_promociones', source: 'local_promos_filtradas' },
        totalResultados: items.length,
      },
    };
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
            ChatResponses.agregarCierreGenerico('Tuve un problema para procesar tu mensaje. ¿Puedes intentarlo de nuevo en un momento?'),
          sugerencias: [],
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

    const seguridad = SafetyPolicy.check(textoCorregido);

    if (seguridad.blocked) {
      const mensajeSeguro = ChatResponses.agregarCierreGenerico(seguridad.message ?? '');

      await this.conversationService.guardarTurnoUsuario(
        idSesionActiva,
        input,
        `bloqueado_${seguridad.category}`,
      );

      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        mensajeSeguro,
        { intent: `bloqueado_${seguridad.category}`, sugerencias: [] },
      );

      return {
        sessionId: idSesionActiva,
        status: 'bloqueado',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        motivo: seguridad.category,
        respuesta: {
          titulo: seguridad.title,
          mensaje: mensajeSeguro,
          sugerencias: [],
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
      const sugerenciasRecuperacion: string[] = [];

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

    const normalizacionSocial = SocialQueryNormalizer.normalize(resolucion.textoEnriquecido);
    let textoParaProcesar = normalizacionSocial.text;

    const itemCatalogoAmbiguo = this.detectarItemCatalogoAmbiguo(textoParaProcesar);

    if (itemCatalogoAmbiguo) {
      return this.responderItemCatalogoAmbiguo({
        input,
        textoCorregido,
        sessionId: idSesionActiva,
        item: itemCatalogoAmbiguo,
        contexto,
        ciudad: sesion.ciudad,
      });
    }

    // JLP-CORTE-PELO-AMBIGUO-FIX: bug reportado por el usuario — pidió
    // "corte de pelo" y Jelpy "no entendió". "Corte de pelo" es un alias
    // real de negocio (barberías/salones de belleza) en
    // `JELPY_SEMANTIC_CATEGORIES`, así que normalmente se manda directo a
    // búsqueda real — pero esa búsqueda solo conoce UNA de las dos
    // categorías que en realidad ofrecen "corte de pelo" (la humana): el
    // mismo catálogo también tiene "estéticas caninas" con corte de pelo
    // para mascotas. Se intercepta aquí, ANTES de clasificar o llamar al
    // microservicio de IA (100% local, sin gastar esa llamada), para
    // decirle al usuario que existen ambas opciones y preguntar para quién
    // es — así se busca la categoría correcta en vez de asumir una a
    // ciegas o cruzarse con el giro equivocado.
    if (ChatResponses.esCortePeloAmbiguo(textoParaProcesar)) {
      const ciudadCortePelo = contexto?.ciudad ?? sesion.ciudad;
      const respuestaCortePelo = ChatResponses.responderCortePeloAmbiguo(ciudadCortePelo);

      // JLP-CORTE-PELO-HILO-FIX: bug reportado por el usuario — Jelpy
      // preguntaba "¿Corte de pelo para ti o para tu mascota?" y, al
      // responder "Para mi", el hilo se perdía ("no entendí bien"). Se
      // guarda esta pregunta como pendiente (igual que ya se hace para
      // "¿Quieres que busque otros negocios similares que sí tengan
      // promo?") para que `ContextResolverUseCase` pueda resolver la
      // siguiente respuesta corta contra ESTA pregunta puntual, en vez de
      // perder el contexto.
      await this.conversationService.guardarPreguntaPendiente(idSesionActiva, {
        tipo: 'corte_pelo_para_quien',
        ciudad: ciudadCortePelo,
      });

      await this.conversationService.guardarTurnoUsuario(
        idSesionActiva,
        input,
        'corte_pelo_ambiguo',
      );

      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        respuestaCortePelo.mensaje,
        { intent: 'corte_pelo_ambiguo', sugerencias: [] },
      );

      return {
        sessionId: idSesionActiva,
        status: 'chat',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        respuesta: {
          ...respuestaCortePelo,
          sugerencias: [],
        },
        debug: { aiIntent: { intent: 'corte_pelo_ambiguo', source: 'local_corte_pelo' } },
      };
    }

    // JLP-MASCOTA-AMBIGUA-FIX: solicitud del usuario — "cuando le digo
    // perro, gato, conejo primero cuando sea esto debemos ver que quiere:
    // un veterinario [o] alguna tienda de accesorios, a menos que diga un
    // doctor para mi perro, un veterinario para mi gato, etc." Mencionar
    // solo el nombre de un animalito no calza con ningún alias de
    // `JELPY_SEMANTIC_CATEGORIES` (ninguna categoría de mascotas tiene un
    // alias de una sola palabra tipo "perro"), así que no se puede asumir a
    // ciegas si el usuario quiere un veterinario o una tienda de
    // accesorios/alimento — son giros de negocio distintos. Primero se
    // reescribe el texto si menciona un animal junto con una palabra "de
    // doctor" genérica (doctor/consulta/clínica/hospital), que POR SÍ SOLA
    // es alias de la categoría de médicos para HUMANOS (`doctores`) — sin
    // esto, "un doctor para mi perro" terminaría buscando doctores humanos,
    // justo lo opuesto de lo que pidió el usuario como ejemplo explícito de
    // caso que NO debe preguntar. Luego, si sigue siendo ambiguo (animal a
    // secas, sin veterinario/doctor/tienda), se pregunta explícitamente,
    // igual que con "corte de pelo" arriba.
    textoParaProcesar = ChatResponses.reescribirComoVeterinarioSiAplica(textoParaProcesar);

    if (ChatResponses.esMascotaAmbigua(textoParaProcesar)) {
      const ciudadMascota = contexto?.ciudad ?? sesion.ciudad;
      const respuestaMascota = ChatResponses.responderMascotaAmbigua(ciudadMascota);

      await this.conversationService.guardarPreguntaPendiente(idSesionActiva, {
        tipo: 'mascota_para_que',
        ciudad: ciudadMascota,
      });

      await this.conversationService.guardarTurnoUsuario(
        idSesionActiva,
        input,
        'mascota_ambigua',
      );

      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        respuestaMascota.mensaje,
        { intent: 'mascota_ambigua', sugerencias: [] },
      );

      return {
        sessionId: idSesionActiva,
        status: 'chat',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        respuesta: {
          ...respuestaMascota,
          sugerencias: [],
        },
        debug: { aiIntent: { intent: 'mascota_ambigua', source: 'local_mascota_ambigua' } },
      };
    }

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

    const filtroPromocionOriginal = this.mencionaPromociones(textoCorregido)
      ? this.extraerTextoFiltroPromocion(textoCorregido, contexto?.ciudad ?? sesion.ciudad)
      : null;
    const filtroPromocionProcesado = this.mencionaPromociones(textoParaProcesar)
      ? this.extraerTextoFiltroPromocion(textoParaProcesar, contexto?.ciudad ?? sesion.ciudad)
      : null;
    const filtroPromocion = filtroPromocionOriginal ?? filtroPromocionProcesado;

    if (filtroPromocion) {
      return this.responderPromocionesFiltradas({
        input,
        textoCorregido,
        textoParaProcesar,
        sessionId: idSesionActiva,
        filtroTexto: filtroPromocion,
        usuarioId,
        contexto,
      });
    }

    if (this.esSolicitudPromosGenerales(textoParaProcesar, aiIntent)) {
      return this.responderPromocionesGenerales({
        input,
        textoCorregido,
        textoParaProcesar,
        sessionId: idSesionActiva,
        usuarioId,
        contexto,
      });
    }

    const esBusquedaReal =
      !!aiIntent.entities?.categoria ||
      !!aiIntent.entities?.subcategoria ||
      !!aiIntent.entities?.especialidad ||
      !!aiIntent.normalized_text;

    if (aiIntent.reply?.mode === 'direct_reply' && !esBusquedaReal) {
      const respuestaTexto = aiIntent.reply.message || '';
      const respuestaConCierre = ChatResponses.agregarCierreGenerico(respuestaTexto);
      const sugerencias: string[] = [];

      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        respuestaConCierre,
        { intent: aiIntent.intent, sugerencias },
      );

      return {
        sessionId: idSesionActiva,
        status: aiIntent.intent === 'chat' ? 'chat' : 'recomendacion',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        respuesta: {
          titulo: aiIntent.reply.title,
          mensaje: respuestaConCierre,
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
            // JLP-DOBLE-PREGUNTA-FIX: este mensaje ya invita a responder
            // ("Cuéntame qué necesitas..."); no se le agrega el cierre
            // genérico (que trae su propia pregunta "¿Hay algo más en lo
            // que pueda ayudarte?") para no hacerle dos peticiones seguidas
            // a un usuario que ya está frustrado.
            mensaje:
              'Entiendo que no encontraste lo que buscabas 😔 Cuéntame qué necesitas con otras palabras y hago mi mejor esfuerzo para ayudarte.',
            // Sin chips aquí a propósito: el usuario está frustrado, no es
            // momento de empujarle más sugerencias/opciones (ver 'queja' en
            // ChatResponses.generarSugerencias).
            sugerencias: [],
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
        // JLP-CATEGORIA-UMBRELLA-FIX: bug reportado por el usuario — Jelpy
        // pregunta "¿Es comida, salud, belleza o algún servicio?" y, al
        // responder literalmente "Comida", recibía la MISMA pregunta otra
        // vez. Se intercepta ANTES de repetir la pregunta genérica: si el
        // mensaje es una de esas palabras sombrilla, se avanza un paso más
        // (chips concretos de esa familia) en vez de dar vueltas en círculo.
        const categoriaUmbrella = ChatResponses.detectarCategoriaUmbrella(textoCorregido);

        if (categoriaUmbrella) {
          const respuestaUmbrella = ChatResponses.responderCategoriaUmbrella(
            categoriaUmbrella,
            contexto?.ciudad ?? sesion.ciudad,
          );

          await this.conversationService.guardarTurnoAsistente(
            idSesionActiva,
            respuestaUmbrella.mensaje,
            { intent: 'categoria_umbrella', sugerencias: [] },
          );

          return {
            sessionId: idSesionActiva,
            status: 'chat',
            mensajeOriginal: input,
            mensajeCorregido: textoCorregido,
            respuesta: respuestaUmbrella,
        debug: { aiIntent, clasificacion, normalizacionSocial },
          };
        }

        const respuestaGuiada = ChatResponses.preguntarAclaracionBusqueda(
          contexto?.ciudad ?? sesion.ciudad,
        );
        const sugerenciasGuiadas: string[] = [];

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
          debug: { aiIntent, clasificacion, normalizacionSocial },
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
      const respuestaChatConCierre = {
        ...respuestaChat,
        mensaje: ChatResponses.agregarCierreGenerico(respuestaChat.mensaje),
      };

      const intentGranular = ChatResponses.detectarIntent(textoCorregido);

      // Chips dinámicos y contextuales (ver ChatResponses.generarSugerencias):
      // cambian según de qué se habló (saludo, promociones, agendar cita...)
      // y están armados con alias reales de negocio, para que si el usuario
      // toca uno, SIEMPRE se interprete correctamente en el siguiente turno
      // (antes eran 2 preguntas fijas que ni siquiera coincidían con ningún
      // patrón de detección, y tocar el chip devolvía "No entendí bien").
      const sugerencias: string[] = [];

      await this.conversationService.guardarTurnoAsistente(
        idSesionActiva,
        respuestaChatConCierre.mensaje,
        { intent: intentGranular, sugerencias },
      );

      return {
        sessionId: idSesionActiva,
        status: 'chat',
        mensajeOriginal: input,
        mensajeCorregido: textoCorregido,
        respuesta: {
          ...respuestaChatConCierre,
          sugerencias,
        },
        debug: { aiIntent, normalizacionSocial },
      };
    }

    await this.historyUseCase.saveQuery(usuarioId ?? 0, textoParaProcesar);

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

    this.registrarTendenciaBusqueda({
      usuarioId,
      sessionId: idSesionActiva,
      queryOriginal: input,
      queryNormalizada: textoParaProcesar,
      textoCorregido,
      ciudadBusqueda,
      contexto,
      aiIntent,
      interpretacion,
      items,
    });

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
    const itemCatalogoBuscado = items.length === 0
      ? this.extraerItemBusquedaCatalogo(textoParaProcesar, ciudadBusqueda)
      : null;

    if (itemCatalogoBuscado) {
      friendly.titulo = 'No encontré ese producto';
      friendly.mensaje =
        `Por ahora no tengo registrado un lugar donde vendan ${itemCatalogoBuscado}. Puedo ayudarte a buscar otra cosa o intentar con otra palabra.`;
      friendly.items = [];
      friendly.sugerencias = [];
      friendly.seguimiento = '¿Qué más te gustaría buscar?';
      friendly.quisisteDecir = undefined;
    }

    if (items.length === 0) {
      const f = interpretacion.filtros_detectados ?? {};

      this.zeroResultLogger
        .execute(textoCorregido, f.ciudad ?? ciudadBusqueda ?? null, {
          categoriaId: f.categoriaId,
          subcategoriaId: f.subcategoriaId,
          intent: aiIntent.intent,
          // JLP-TREND-SUSCRIPTOR-FIX: atribuir el zero-result al suscriptor
          // y a la sesión para poder mostrarlo en "Jelpy Trend".
          usuarioId: usuarioId ?? null,
          sessionId: idSesionActiva ?? null,
        })
        .catch(() => null);
    }

    if (items.length === 0 && !itemCatalogoBuscado) {
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
        'vende',
        'venden',
        'vendan',
        'vender',
        'venta',
        'encuentro',
        'encontrar',
        'consigo',
        'comprar',
        'compra',
        'necesito',
        'necesita',
        'necesitas',
        'dame',
        'dime',
        'lugar',
        'lugares',
        'negocio',
        'negocios',
        'esta',
        'está',
        'estan',
        'están',
        'mas',
        'más',
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
    if (normalizacionSocial.userFacingHint) {
      friendly.contexto = normalizacionSocial.userFacingHint;
    }

    const filtrosDetectados = interpretacion.filtros_detectados ?? {};
    const sugerencias: string[] = [];
    friendly.sugerencias = [];
    friendly.seguimiento = itemCatalogoBuscado
      ? friendly.seguimiento
      : ChatResponses.cierreGenerico();

    await this.conversationService.guardarTurnoAsistente(
      idSesionActiva,
      friendly.mensaje || `Encontré ${items.length} resultado(s).`,
      {
        intent: aiIntent.intent,
        totalResultados: items.length,
        filtros: filtrosDetectados,
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
