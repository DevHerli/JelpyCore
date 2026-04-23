import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Bookmark } from './entities/bookmark.entity';
import { EventoNegocio } from '../eventos_negocios/entities/evento-negocio.entity';
import { LecturaEventoNegocio } from '../eventos_negocios/entities/lectura-evento-negocio.entity';

@Injectable()
export class BookmarksService {
  constructor(
    @InjectRepository(Bookmark)
    private readonly bookmarkRepo: Repository<Bookmark>,

    @InjectRepository(EventoNegocio)
    private readonly eventoNegocioRepo: Repository<EventoNegocio>,

    @InjectRepository(LecturaEventoNegocio)
    private readonly lecturaEventoNegocioRepo: Repository<LecturaEventoNegocio>,
  ) {}

  async toggle(sucursalId: number, suscriptorId: number) {
    const existing = await this.bookmarkRepo.findOne({
      where: {
        sucursal: { id: sucursalId },
        suscriptor: { id: suscriptorId },
      },
      relations: ['sucursal', 'suscriptor'],
    });

    if (existing) {
      await this.bookmarkRepo.remove(existing);

      return {
        bookmarked: false,
        message: 'Eliminado de favoritos',
      };
    }

    const bookmark = this.bookmarkRepo.create({
      sucursal: { id: sucursalId } as any,
      suscriptor: { id: suscriptorId } as any,
    });

    await this.bookmarkRepo.save(bookmark);

    return {
      bookmarked: true,
      message: 'Agregado a favoritos',
    };
  }

  async findByUser(suscriptorId: number) {
    return this.bookmarkRepo.find({
      where: { suscriptor: { id: suscriptorId } },
      relations: [
        'sucursal',
        'sucursal.negocio',
      ],
      order: { fechaCreacion: 'DESC' },
    });
  }

  async isBookmarked(sucursalId: number, suscriptorId: number) {
    const existing = await this.bookmarkRepo.findOne({
      where: {
        sucursal: { id: sucursalId },
        suscriptor: { id: suscriptorId },
      },
    });

    return {
      bookmarked: !!existing,
    };
  }

  async obtenerResumenNoLeidosFavoritos(suscriptorId: number) {
    const suscriptorIdNum = Number(suscriptorId);

    if (!Number.isFinite(suscriptorIdNum) || suscriptorIdNum <= 0) {
      throw new BadRequestException('suscriptorId inválido.');
    }

    const favoritos = await this.bookmarkRepo.find({
      where: {
        suscriptor: { id: suscriptorIdNum },
      },
      relations: ['sucursal', 'sucursal.negocio'],
    });

    if (!favoritos.length) {
      return {
        totalFavoritosConNovedades: 0,
        totalEventosNoLeidos: 0,
      };
    }

    let totalFavoritosConNovedades = 0;
    let totalEventosNoLeidos = 0;

    for (const favorito of favoritos) {
      const sucursalId = Number(favorito.sucursal?.id);
      const negocioId = Number(favorito.sucursal?.negocio?.id);

      if (!negocioId || !sucursalId) continue;

      const totalNoLeidos = await this.eventoNegocioRepo
        .createQueryBuilder('evento')
        .leftJoin(
          'lecturas_eventos_negocios',
          'lectura',
          'lectura.evento_negocio_id = evento.id AND lectura.suscriptor_id = :suscriptorId',
          { suscriptorId: suscriptorIdNum },
        )
        .where('evento.activo = 1')
        .andWhere('evento.visible_para_favoritos = 1')
        .andWhere('lectura.id IS NULL')
        .andWhere(
          '(evento.negocio_id = :negocioId AND (evento.sucursal_id IS NULL OR evento.sucursal_id = :sucursalId))',
          { negocioId, sucursalId },
        )
        .getCount();

      if (totalNoLeidos > 0) {
        totalFavoritosConNovedades += 1;
        totalEventosNoLeidos += totalNoLeidos;
      }
    }

    return {
      totalFavoritosConNovedades,
      totalEventosNoLeidos,
    };
  }

  async obtenerFavoritosConNovedades(suscriptorId: number) {
    const suscriptorIdNum = Number(suscriptorId);

    if (!Number.isFinite(suscriptorIdNum) || suscriptorIdNum <= 0) {
      throw new BadRequestException('suscriptorId inválido.');
    }

    const favoritos = await this.bookmarkRepo.find({
      where: {
        suscriptor: { id: suscriptorIdNum },
      },
      relations: [
        'sucursal',
        'sucursal.negocio',
        'sucursal.imagenes',
        'sucursal.ciudad',
      ],
      order: { fechaCreacion: 'DESC' },
    });

    const resultado: any[] = [];

    for (const favorito of favoritos) {
      const sucursalId = Number(favorito.sucursal?.id);
      const negocioId = Number(favorito.sucursal?.negocio?.id);

      if (!negocioId || !sucursalId) {
        resultado.push({
          ...favorito,
          hasUnreadUpdates: false,
          unreadCount: 0,
          lastEvent: null,
        });
        continue;
      }

      const eventosNoLeidos = await this.eventoNegocioRepo
        .createQueryBuilder('evento')
        .leftJoin(
          'lecturas_eventos_negocios',
          'lectura',
          'lectura.evento_negocio_id = evento.id AND lectura.suscriptor_id = :suscriptorId',
          { suscriptorId: suscriptorIdNum },
        )
        .where('evento.activo = 1')
        .andWhere('evento.visible_para_favoritos = 1')
        .andWhere('lectura.id IS NULL')
        .andWhere(
          '(evento.negocio_id = :negocioId AND (evento.sucursal_id IS NULL OR evento.sucursal_id = :sucursalId))',
          { negocioId, sucursalId },
        )
        .orderBy('evento.fecha_evento', 'DESC')
        .getMany();

      const ultimoEvento = await this.eventoNegocioRepo
        .createQueryBuilder('evento')
        .where('evento.activo = 1')
        .andWhere('evento.visible_para_favoritos = 1')
        .andWhere(
          '(evento.negocio_id = :negocioId AND (evento.sucursal_id IS NULL OR evento.sucursal_id = :sucursalId))',
          { negocioId, sucursalId },
        )
        .orderBy('evento.fecha_evento', 'DESC')
        .getOne();

      resultado.push({
        ...favorito,
        hasUnreadUpdates: eventosNoLeidos.length > 0,
        unreadCount: eventosNoLeidos.length,
        lastEvent: ultimoEvento
          ? {
              id: ultimoEvento.id,
              tipoEvento: ultimoEvento.tipoEvento,
              titulo: ultimoEvento.titulo,
              descripcion: ultimoEvento.descripcion,
              fechaEvento: ultimoEvento.fechaEvento,
              sucursalId: ultimoEvento.sucursalId,
              negocioId: ultimoEvento.negocioId,
              payload: ultimoEvento.payload,
            }
          : null,
      });
    }

    return resultado;
  }

  async marcarEventosFavoritoComoLeidos(
    suscriptorId: number,
    negocioId: number,
    sucursalId?: number,
  ) {
    const suscriptorIdNum = Number(suscriptorId);
    const negocioIdNum = Number(negocioId);
    const sucursalIdNum =
      sucursalId !== undefined && sucursalId !== null ? Number(sucursalId) : undefined;

    if (!Number.isFinite(suscriptorIdNum) || suscriptorIdNum <= 0) {
      throw new BadRequestException('suscriptorId inválido.');
    }

    if (!Number.isFinite(negocioIdNum) || negocioIdNum <= 0) {
      throw new BadRequestException('negocioId inválido.');
    }

    const query = this.eventoNegocioRepo
      .createQueryBuilder('evento')
      .leftJoin(
        'lecturas_eventos_negocios',
        'lectura',
        'lectura.evento_negocio_id = evento.id AND lectura.suscriptor_id = :suscriptorId',
        { suscriptorId: suscriptorIdNum },
      )
      .where('evento.activo = 1')
      .andWhere('evento.visible_para_favoritos = 1')
      .andWhere('lectura.id IS NULL')
      .andWhere('evento.negocio_id = :negocioId', { negocioId: negocioIdNum });

    if (sucursalIdNum && Number.isFinite(sucursalIdNum) && sucursalIdNum > 0) {
      query.andWhere('(evento.sucursal_id IS NULL OR evento.sucursal_id = :sucursalId)', {
        sucursalId: sucursalIdNum,
      });
    } else {
      query.andWhere('evento.sucursal_id IS NULL');
    }

    const eventosPendientes = await query.getMany();

    if (!eventosPendientes.length) {
      return {
        message: 'No había eventos pendientes por marcar',
        totalMarcados: 0,
      };
    }

    const nuevasLecturas = eventosPendientes.map((evento) =>
      this.lecturaEventoNegocioRepo.create({
        eventoNegocioId: Number(evento.id),
        suscriptorId: suscriptorIdNum,
      }),
    );

    await this.lecturaEventoNegocioRepo.save(nuevasLecturas);

    return {
      message: 'Eventos del favorito marcados como leídos correctamente',
      totalMarcados: nuevasLecturas.length,
    };
  }
}