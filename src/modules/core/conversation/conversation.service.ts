import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { ConversationSession } from './entities/conversation-session.entity';
import { ConversationTurn } from './entities/conversation-turn.entity';

const INACTIVIDAD_MINUTOS = 30;
const MAX_TURNS_HISTORIAL = 6; // últimos 6 turnos (3 intercambios) al cargar contexto

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(ConversationSession)
    private readonly sessionRepo: Repository<ConversationSession>,

    @InjectRepository(ConversationTurn)
    private readonly turnRepo: Repository<ConversationTurn>,
  ) {}

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
  async guardarTurnoUsuario(
    sessionId: string,
    mensaje: string,
    intent?: string,
  ): Promise<void> {
    await this.turnRepo.save(
      this.turnRepo.create({
        sessionId,
        rol: 'user',
        mensaje,
        intent,
        creadoEn: new Date(),
      }),
    );
  }

  // ------------------------------------------------------------------
  // GUARDAR TURNO DEL ASISTENTE
  // ------------------------------------------------------------------
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
  }

  // ------------------------------------------------------------------
  // ACTUALIZAR CONTEXTO DE BÚSQUEDA EN LA SESIÓN
  // ------------------------------------------------------------------
  async actualizarContextoBusqueda(
    sessionId: string,
    intent: string,
    filtros: any,
    resultado: any[],
    query: string,
  ): Promise<void> {
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
  async guardarPreguntaPendiente(
    sessionId: string,
    pendiente: { tipo: string; categoria?: string; ciudad?: string } | null,
  ): Promise<void> {
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
  }

  // ------------------------------------------------------------------
  // OBTENER HISTORIAL DE TURNOS RECIENTES
  // ------------------------------------------------------------------
  async obtenerHistorial(sessionId: string): Promise<ConversationTurn[]> {
    return this.turnRepo.find({
      where: { sessionId },
      order: { creadoEn: 'DESC' },
      take: MAX_TURNS_HISTORIAL,
    });
  }

  // ------------------------------------------------------------------
  // OBTENER SESIÓN CON CONTEXTO COMPLETO
  // ------------------------------------------------------------------
  async obtenerContextoSesion(sessionId: string): Promise<ConversationSession | null> {
    return this.sessionRepo.findOne({ where: { id: sessionId, activa: true } });
  }

  // ------------------------------------------------------------------
  // LIMPIAR SESIONES INACTIVAS (llamar periódicamente o en cada request)
  // ------------------------------------------------------------------
  async limpiarSesionesViejas(): Promise<void> {
    const limite = new Date();
    limite.setMinutes(limite.getMinutes() - INACTIVIDAD_MINUTOS);

    try {
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
