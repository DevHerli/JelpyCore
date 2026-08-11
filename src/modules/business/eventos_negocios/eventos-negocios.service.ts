import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
  } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { In, Repository } from 'typeorm';

  import { EventoNegocio } from './entities/evento-negocio.entity';
  import { LecturaEventoNegocio } from './entities/lectura-evento-negocio.entity';
  import { Negocio } from '../negocios/entities/negocio.entity';
  import { CrearEventoNegocioDto } from './dtos/crear-evento-negocio.dto';
  import { MarcarEventosLeidosDto } from './dtos/marcar-eventos-leidos.dto';

  // JLP-M23: contexto del solicitante para verificar propiedad del negocio.
  export type RequesterCtx = { sub: number; isAdmin: boolean };

  @Injectable()
  export class EventosNegociosService {
    constructor(
      @InjectRepository(EventoNegocio)
      private readonly eventoNegocioRepository: Repository<EventoNegocio>,

      @InjectRepository(LecturaEventoNegocio)
      private readonly lecturaEventoNegocioRepository: Repository<LecturaEventoNegocio>,

      @InjectRepository(Negocio)
      private readonly negocioRepository: Repository<Negocio>,
    ) {}

    /**
     * JLP-M23: verifica que el solicitante sea dueño del negocio (o admin).
     * `requester` opcional → los llamadores internos (p.ej. emisión de eventos
     * desde promociones) omiten la verificación conservando su comportamiento.
     */
    private async assertOwnershipByNegocio(
      negocioId: number,
      requester?: RequesterCtx,
    ): Promise<void> {
      if (!requester || requester.isAdmin) return;

      const negocio = await this.negocioRepository.findOne({
        where: { id: negocioId },
        relations: ['suscriptor'],
      });

      if (!negocio) {
        throw new NotFoundException('Negocio no encontrado');
      }

      if (negocio.suscriptor?.id !== requester.sub) {
        throw new ForbiddenException('No tienes permiso sobre este negocio');
      }
    }

    async crear(
      crearEventoNegocioDto: CrearEventoNegocioDto,
      requester?: RequesterCtx,
    ): Promise<EventoNegocio> {
      await this.assertOwnershipByNegocio(crearEventoNegocioDto.negocioId, requester);

      const nuevoEvento = this.eventoNegocioRepository.create({
        negocioId: crearEventoNegocioDto.negocioId,
        sucursalId: crearEventoNegocioDto.sucursalId ?? null,
        tipoEvento: crearEventoNegocioDto.tipoEvento,
        titulo: crearEventoNegocioDto.titulo,
        descripcion: crearEventoNegocioDto.descripcion ?? null,
        payload: crearEventoNegocioDto.payload ?? null,
        visibleParaFavoritos: crearEventoNegocioDto.visibleParaFavoritos ?? true,
        activo: crearEventoNegocioDto.activo ?? true,
      });
  
      return await this.eventoNegocioRepository.save(nuevoEvento);
    }
  
    async obtenerTodos(): Promise<EventoNegocio[]> {
      return await this.eventoNegocioRepository.find({
        relations: ['negocio', 'sucursal'],
        order: { fechaEvento: 'DESC' },
      });
    }
  
    async obtenerUno(id: number): Promise<EventoNegocio> {
      const evento = await this.eventoNegocioRepository.findOne({
        where: { id },
        relations: ['negocio', 'sucursal', 'lecturas'],
      });
  
      if (!evento) {
        throw new NotFoundException('Evento de negocio no encontrado');
      }
  
      return evento;
    }
  
    async obtenerPorNegocio(negocioId: number): Promise<EventoNegocio[]> {
      return await this.eventoNegocioRepository.find({
        where: {
          negocioId,
          activo: true,
        },
        relations: ['sucursal'],
        order: { fechaEvento: 'DESC' },
      });
    }
  
    async obtenerPorSucursal(sucursalId: number): Promise<EventoNegocio[]> {
      return await this.eventoNegocioRepository.find({
        where: {
          sucursalId,
          activo: true,
        },
        relations: ['negocio'],
        order: { fechaEvento: 'DESC' },
      });
    }
  
    async marcarEventosComoLeidos(
      marcarEventosLeidosDto: MarcarEventosLeidosDto,
    ): Promise<{ message: string; totalMarcados: number }> {
      const { suscriptorId, eventoIds } = marcarEventosLeidosDto;
  
      if (!eventoIds?.length) {
        throw new BadRequestException('Debes enviar al menos un evento');
      }
  
      const eventos = await this.eventoNegocioRepository.find({
        where: { id: In(eventoIds) },
        select: ['id'],
      });
  
      if (!eventos.length) {
        throw new NotFoundException('No se encontraron eventos para marcar como leídos');
      }
  
      const idsValidos = eventos.map((evento) => evento.id);
  
      const lecturasExistentes = await this.lecturaEventoNegocioRepository.find({
        where: {
          suscriptorId,
          eventoNegocioId: In(idsValidos),
        },
        select: ['eventoNegocioId'],
      });
  
      const idsYaLeidos = new Set(lecturasExistentes.map((lectura) => lectura.eventoNegocioId));
  
      const nuevasLecturas = idsValidos
        .filter((id) => !idsYaLeidos.has(id))
        .map((id) =>
          this.lecturaEventoNegocioRepository.create({
            eventoNegocioId: id,
            suscriptorId,
          }),
        );
  
      if (nuevasLecturas.length > 0) {
        await this.lecturaEventoNegocioRepository.save(nuevasLecturas);
      }
  
      return {
        message: 'Eventos marcados como leídos correctamente',
        totalMarcados: nuevasLecturas.length,
      };
    }
  
    async obtenerEventosNoLeidosPorSuscriptor(suscriptorId: number): Promise<EventoNegocio[]> {
      return await this.eventoNegocioRepository
        .createQueryBuilder('evento')
        .leftJoin(
          'lecturas_eventos_negocios',
          'lectura',
          'lectura.evento_negocio_id = evento.id AND lectura.suscriptor_id = :suscriptorId',
          { suscriptorId },
        )
        .leftJoinAndSelect('evento.negocio', 'negocio')
        .leftJoinAndSelect('evento.sucursal', 'sucursal')
        .where('evento.activo = 1')
        .andWhere('evento.visible_para_favoritos = 1')
        .andWhere('lectura.id IS NULL')
        .orderBy('evento.fecha_evento', 'DESC')
        .getMany();
    }
  
    async desactivar(
      id: number,
      requester?: RequesterCtx,
    ): Promise<{ message: string }> {
      const evento = await this.obtenerUno(id);

      // JLP-M23: solo el dueño del negocio del evento (o admin) puede desactivarlo.
      await this.assertOwnershipByNegocio(evento.negocioId, requester);

      evento.activo = false;
      await this.eventoNegocioRepository.save(evento);

      return { message: 'Evento de negocio desactivado correctamente' };
    }
  }