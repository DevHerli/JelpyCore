import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThanOrEqual } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { ConversationSession } from './entities/conversation-session.entity';
import { ConversationTurn } from './entities/conversation-turn.entity';

const RETENCION_CHAT_HORAS = 24;
const INACTIVIDAD_MINUTOS = RETENCION_CHAT_HORAS * 60;
const MAX_TURNS_HISTORIAL = 6; // últimos 6 turnos (3 intercambios) al cargar contexto interno de IA
// Tope de seguridad (no de negocio) para el historial COMPLETO que ve el
// usuario: evita respuestas gigantes en el caso extremo de una sesión con
// muchísimos turnos dentro de la ventana de retención. Muy por encima de
// cualquier conversación real, así que no reintroduce el bug de truncar
// historial reciente.
const MAX_TURNS_HISTORIAL_COMPLETO = 200;

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(ConversationSession)
    private readonly sessionRepo: Repository<ConversationSession>,

    @InjectRepository(ConversationTurn)
    private readonly turnRepo: Repository<ConversationTurn>,
  ) {}

  obtenerPoliticaRetencion() {
    return {
      ttlHoras: RETENCION_CHAT_HORAS,
      mensaje:
        'Los mensajes de este chat se eliminan automáticamente después de 24 horas. Jelpy conserva métricas de búsqueda agregadas para mejorar el servicio.',
    };
  }

  // ------------------------------------------------------------------
  // OBTENER O CREAR SESIÓN
  // ------------------------------------------------------------------
  async obtenerOCrearSesion(
    sessionId: string | undefined,
    usuarioId?: number,
    ciudad?: string,
  ): Promise<ConversationSession> {
    // Si viene sessionId, intentamos cargarla
    if (sessionId) {
      const existente = await this.sessionRepo.findOne({
        where: { id: sessionId, activa: true },
      });

      if (existente) {
        // Actualizar ciudad si cambió
        if (ciudad && ciudad !== existente.ciudad) {
          existente.ciudad = ciudad;
        }
        existente.actualizadoEn = new Date();
        return this.sessionRepo.save(existente);
      }
    }

    // JLP-CONTEXT-THREAD-FIX: bug reportado por el usuario — tras una
    // búsqueda de farmacias, tocar el chip de seguimiento "¿Quieres ver la
    // más cercana a ti?" respondía "No entendí bien", rompiendo el hilo de
    // la conversación. Una de las causas raíz: cuando el cliente no
    // reenviaba el `sessionId` (o enviaba uno que ya no existe), este
    // método SIEMPRE creaba una sesión nueva desde cero, heredando
    // únicamente la ciudad del usuario — perdiendo `ultimaQuery`,
    // `ultimoResultado` y `ultimoIntent`, con lo que `hasSearchContext` se
    // volvía falso en el siguiente turno y cualquier chip de refinamiento
    // caía en la respuesta genérica de "no entendí".
    //
    // Ahora, si el usuario está autenticado, reutilizamos su sesión activa
    // más reciente COMPLETA (no solo la ciudad) en vez de crear una nueva,
    // para que el contexto de búsqueda sobreviva aunque el cliente no
    // reenvíe el sessionId correctamente. La sesión sigue acotada por la
    // misma ventana de inactividad de siempre (`activa: true`, limpiada
    // periódicamente por `limpiarSesionesViejas()`), así que esto no
    // "resucita" conversaciones ya expiradas.
    if (usuarioId) {
      try {
        const sesionPrevia = await this.sessionRepo.findOne({
          where: { usuarioId, activa: true },
          order: { actualizadoEn: 'DESC' },
        });
        if (sesionPrevia) {
          if (ciudad && ciudad !== sesionPrevia.ciudad) {
            sesionPrevia.ciudad = ciudad;
          }
          sesionPrevia.actualizadoEn = new Date();
          this.logger.debug(
            `[Sesión] Reutilizando sesión activa ${sesionPrevia.id} del usuario ${usuarioId} ` +
              `(sessionId recibido: ${sessionId ?? 'ninguno'}) para conservar el hilo de la conversación`,
          );
          return this.sessionRepo.save(sesionPrevia);
        }
      } catch {
        // No interrumpir flujo si falla
      }
    }

    // Crear nueva sesión (usuario anónimo, o autenticado sin sesión previa activa)
    const nueva = this.sessionRepo.create({
      id: sessionId || uuidv4(),
      usuarioId,
      ciudad,
      activa: true,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    });

    return this.sessionRepo.save(nueva);
  }

  // ------------------------------------------------------------------
  // GUARDAR TURNO DE USUARIO
  // ------------------------------------------------------------------
  // JLP-TURNO-BLINDADO-FIX: bug reportado por el usuario — "promo suchi"
  // (y, en general, mensajes ocasionales sin patrón aparente) devolvían de
  // golpe "Tuve un problema para procesar tu mensaje..." (el catch-all de
  // último nivel en `AiService.processUserMessage()`). Se investigó a fondo
  // la hipótesis de que fuera un problema de "sushi" específicamente
  // (ortografía, detección de categoría, filtro de promos) y, tras
  // reproducir el flujo completo punta a punta contra la BD y el
  // microservicio de FastAPI reales (con y sin FastAPI disponible, con y
  // sin sesión previa, con distintos usuarios), NUNCA se logró reproducir
  // un error para ese mensaje puntual — la ortografía sí corrige
  // "suchi" → "sushi" correctamente (ver `OrthographyCheckUseCase`) y el
  // resto del pipeline responde bien en todos los escenarios probados.
  //
  // Lo que sí se encontró: estos métodos de guardado de turno (llamados
  // en CASI cada rama de `AiService.processUserMessageInterno()`, es decir,
  // en la gran mayoría de mensajes que procesa Jelpy) NO tenían ningún
  // manejo de errores — a diferencia de otros efectos secundarios no
  // críticos del mismo archivo (métricas, tendencias de búsqueda,
  // publicidad, likes), que sí están blindados con try/catch para que un
  // fallo transitorio de BD (conexión caída, deadlock, timeout puntual)
  // nunca tumbe la respuesta completa al usuario. Guardar el turno en el
  // historial es importante pero NO crítico para poder responder: es
  // preferible devolver la respuesta sin guardar ese turno puntual, que
  // hacer fallar TODA la conversación con el mensaje genérico de error.
  // Esto es coherente con el resto del archivo y cierra la fuente más
  // plausible (y más frecuente, al tocar casi cualquier mensaje) de este
  // tipo de error intermitente y difícil de reproducir.
  async guardarTurnoUsuario(
    sessionId: string,
    mensaje: string,
    intent?: string,
  ): Promise<void> {
    try {
      await this.turnRepo.save(
        this.turnRepo.create({
          sessionId,
          rol: 'user',
          mensaje,
          intent,
          creadoEn: new Date(),
        }),
      );
    } catch (err) {
      this.logger.warn(
        `No se pudo guardar el turno de usuario de la sesión ${sessionId}`,
        err,
      );
    }
  }

  // ------------------------------------------------------------------
  // GUARDAR TURNO DEL ASISTENTE
  // ------------------------------------------------------------------
  // JLP-TURNO-BLINDADO-FIX: ver comentario en `guardarTurnoUsuario()`.
  async guardarTurnoAsistente(
    sessionId: string,
    respuesta: string,
    metadata?: {
      totalResultados?: number;
      filtros?: any;
      intent?: string;
      sugerencias?: string[];  // sugerencias mostradas al usuario en este turno
    },
  ): Promise<void> {
    try {
      await this.turnRepo.save(
        this.turnRepo.create({
          sessionId,
          rol: 'assistant',
          mensaje: respuesta,
          intent: metadata?.intent,
          metadata,
          creadoEn: new Date(),
        }),
      );
    } catch (err) {
      this.logger.warn(
        `No se pudo guardar el turno del asistente de la sesión ${sessionId}`,
        err,
      );
    }
  }

  // ------------------------------------------------------------------
  // ACTUALIZAR CONTEXTO DE BÚSQUEDA EN LA SESIÓN
  // ------------------------------------------------------------------
  // JLP-TURNO-BLINDADO-FIX: ver comentario en `guardarTurnoUsuario()`. Si
  // esto falla, el usuario igual recibe sus resultados de búsqueda — solo
  // se pierde el contexto de seguimiento de ESE turno puntual, en vez de
  // perder la respuesta completa.
  async actualizarContextoBusqueda(
    sessionId: string,
    intent: string,
    filtros: any,
    resultado: any[],
    query: string,
  ): Promise<void> {
    try {
      // Guardamos un resumen de los items (máx. 10) para no inflar el JSON
      const resumenItems = (resultado || []).slice(0, 10).map((item: any) => ({
        id: item.id,
        sucursalId: item.sucursalId || item.sucursal_id || item.sucursal?.id,
        nombre: item.nombre || item.nombre_negocio || item.name,
        categoria: item.categoria || item.nombreCategoria,
        ciudad: item.ciudad || item.nombreCiudad,
        telefono: item.telefono,
        horario: item.horario,
        tieneDomicilio: item.domicilio || item.a_domicilio || false,
        promo: item.promo || false,
        distancia: item.distancia,
        likes: item.likes,
      }));

      await this.sessionRepo.update(
        { id: sessionId },
        {
          ultimoIntent: intent,
          ultimosFiltros: filtros,
          ultimoResultado: resumenItems,
          ultimaQuery: query,
          actualizadoEn: new Date(),
        },
      );
    } catch (err) {
      this.logger.warn(
        `No se pudo actualizar el contexto de búsqueda de la sesión ${sessionId}`,
        err,
      );
    }
  }

  // ------------------------------------------------------------------
  // GUARDAR/LIMPIAR PREGUNTA DE CONFIRMACIÓN PENDIENTE
  // ------------------------------------------------------------------
  // JLP-CONFIRMACION-PENDIENTE-FIX: bug reportado por el usuario — Jelpy
  // preguntó "¿Quieres que busque otros negocios similares que sí tengan
  // promo?" y, al responder "Sí", el usuario recibió "Dime qué necesitas
  // y busco en Tepic...", ignorando la propia pregunta que Jelpy acababa
  // de hacer. Se guarda aquí qué pregunta quedó pendiente (dentro de
  // `ultimosFiltros`, sin requerir una columna nueva) para que
  // `ContextResolverUseCase` pueda resolver un "Sí"/"No" posterior contra
  // la acción real que se ofreció, en vez de tratarlo como relleno sin
  // sentido. Se llama SIEMPRE que se genera una respuesta de detalle
  // (con `pendiente = null` cuando esa respuesta puntual no ofrece
  // ninguna confirmación), para que una pregunta pendiente nunca quede
  // "viva" más de un turno sin resolverse.
  // ------------------------------------------------------------------
  // JLP-TURNO-BLINDADO-FIX: ver comentario en `guardarTurnoUsuario()` — se
  // llama en casi cualquier respuesta de seguimiento/detalle, así que un
  // fallo transitorio de BD aquí no debe tumbar toda la respuesta.
  async guardarPreguntaPendiente(
    sessionId: string,
    pendiente: { tipo: string; categoria?: string; ciudad?: string } | null,
  ): Promise<void> {
    try {
      const sesion = await this.sessionRepo.findOne({ where: { id: sessionId } });
      if (!sesion) return;

      const filtrosActuales = { ...(sesion.ultimosFiltros || {}) };
      delete filtrosActuales.pendienteConfirmacion;

      if (pendiente) {
        filtrosActuales.pendienteConfirmacion = pendiente;
      }

      await this.sessionRepo.update(
        { id: sessionId },
        { ultimosFiltros: filtrosActuales, actualizadoEn: new Date() },
      );
    } catch (err) {
      this.logger.warn(
        `No se pudo guardar la pregunta pendiente de la sesión ${sessionId}`,
        err,
      );
    }
  }

  // ------------------------------------------------------------------
  // OBTENER HISTORIAL DE TURNOS RECIENTES
  // ------------------------------------------------------------------
  // JLP-TURNO-BLINDADO-FIX: usado en el fast-path de chat para decidir el
  // tono del saludo (primera interacción vs. continuación) — si la lectura
  // falla, es preferible asumir "sin historial" que tumbar la respuesta.
  async obtenerHistorial(sessionId: string): Promise<ConversationTurn[]> {
    try {
      return await this.turnRepo.find({
        where: { sessionId },
        order: { creadoEn: 'DESC' },
        take: MAX_TURNS_HISTORIAL,
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo obtener el historial de la sesión ${sessionId}`,
        err,
      );
      return [];
    }
  }

  // ------------------------------------------------------------------
  // OBTENER HISTORIAL COMPLETO (para mostrarle al usuario en el chat)
  // ------------------------------------------------------------------
  // JLP-RETENCION-HISTORIAL-FIX: bug reportado por el usuario — el chat le
  // dice que los mensajes se conservan 24 horas (`obtenerPoliticaRetencion`)
  // pero, en la práctica, al reabrir el chat "los mensajes no se guardan ni
  // una hora". Se investigó a fondo (incluyendo lectura directa de datos
  // reales en la BD de producción) y la retención en BD SÍ funciona: los
  // turnos de conversación permanecen en `conversation_turns` hasta que
  // `limpiarSesionesViejas()` los borra pasadas las 24 horas configuradas
  // (`RETENCION_CHAT_HORAS`). El bug real es OTRO: el endpoint público
  // `GET /ai/historial/:sessionId` (que el frontend usa para mostrar
  // mensajes previos al abrir el chat) reutilizaba `obtenerHistorial()`,
  // cuyo límite `MAX_TURNS_HISTORIAL = 6` fue pensado para un propósito
  // DISTINTO: alimentar con muy poco contexto la lógica interna de
  // saludo/tono de `AiService` en cada mensaje nuevo (a propósito, un
  // límite chico ahí). Al conflictar ambos usos, cualquier sesión con más
  // de 3 intercambios (6 turnos) — algo muy común en pocos minutos de
  // conversación — mostraba solo los últimos 3 intercambios al reabrir el
  // chat, sin importar qué tan reciente fuera el resto: parecía que los
  // mensajes "se borraban" casi de inmediato, cuando en realidad seguían
  // vivos en BD, solo que el endpoint no los devolvía.
  //
  // Este método es la separación explícita: devuelve TODOS los turnos de
  // la sesión dentro de la ventana real de retención (24 horas), sin el
  // límite de 6 turnos, para que el historial que ve el usuario coincida
  // con lo que el mensaje de política de retención promete. `obtenerHistorial()`
  // se deja intacto para su propósito original (contexto interno de IA).
  async obtenerHistorialCompleto(sessionId: string): Promise<ConversationTurn[]> {
    try {
      const limite = new Date();
      limite.setHours(limite.getHours() - RETENCION_CHAT_HORAS);

      return await this.turnRepo.find({
        where: { sessionId, creadoEn: MoreThanOrEqual(limite) },
        order: { creadoEn: 'DESC' },
        take: MAX_TURNS_HISTORIAL_COMPLETO,
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo obtener el historial completo de la sesión ${sessionId}`,
        err,
      );
      return [];
    }
  }

  // ------------------------------------------------------------------
  // OBTENER SESIÓN CON CONTEXTO COMPLETO
  // ------------------------------------------------------------------
  async obtenerContextoSesion(sessionId: string): Promise<ConversationSession | null> {
    return this.sessionRepo.findOne({ where: { id: sessionId, activa: true } });
  }

  // ------------------------------------------------------------------
  // LIMPIAR SESIONES INACTIVAS Y BORRAR CHATS EXPIRADOS
  // ------------------------------------------------------------------
  async limpiarSesionesViejas(): Promise<void> {
    const limite = new Date();
    limite.setMinutes(limite.getMinutes() - INACTIVIDAD_MINUTOS);

    try {
      // Primero borramos turnos viejos. Las métricas de búsqueda viven en
      // tablas separadas, así que esto elimina conversación, no aprendizaje.
      await this.turnRepo.delete({ creadoEn: LessThan(limite) });

      await this.sessionRepo.delete({ actualizadoEn: LessThan(limite) });

      await this.sessionRepo.update(
        { activa: true, actualizadoEn: LessThan(limite) },
        { activa: false },
      );
    } catch (err) {
      this.logger.warn('Error limpiando sesiones viejas', err);
    }
  }

  // ------------------------------------------------------------------
  // MARCAR SESIÓN COMO INACTIVA (logout o cierre explícito)
  // ------------------------------------------------------------------
  async cerrarSesion(sessionId: string): Promise<void> {
    await this.sessionRepo.update({ id: sessionId }, { activa: false });
  }
}
