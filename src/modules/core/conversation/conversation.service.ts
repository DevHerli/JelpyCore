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

    // Buscar sesión previa del mismo usuario para heredar contexto (ciudad)
    let ciudadHeredada = ciudad;
    if (usuarioId && !ciudadHeredada) {
      try {
        const sesionPrevia = await this.sessionRepo.findOne({
          where: { usuarioId, activa: true },
          order: { actualizadoEn: 'DESC' },
        });
        if (sesionPrevia) {
          ciudadHeredada = sesionPrevia.ciudad ?? ciudad;
          this.logger.debug(
            `[Sesión] Heredando ciudad "${ciudadHeredada}" del usuario ${usuarioId}`,
          );
        }
      } catch {
        // No interrumpir flujo si falla
      }
    }

    // Crear nueva sesión
    const nueva = this.sessionRepo.create({
      id: sessionId || uuidv4(),
      usuarioId,
      ciudad: ciudadHeredada,
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
