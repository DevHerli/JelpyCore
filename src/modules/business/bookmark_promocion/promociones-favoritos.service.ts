import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PromocionFavorito } from './entities/promocion-favorito.entity';

@Injectable()
export class PromocionesFavoritosService {
  constructor(
    @InjectRepository(PromocionFavorito)
    private readonly favoritoRepo: Repository<PromocionFavorito>,
  ) {}

  private assertIds(promocionId: number, suscriptorId: number): void {
    if (!Number.isFinite(promocionId) || promocionId <= 0) {
      throw new BadRequestException('promocionId inválido.');
    }
    if (!Number.isFinite(suscriptorId) || suscriptorId <= 0) {
      throw new BadRequestException('suscriptorId inválido.');
    }
  }

  async toggle(promocionId: number, suscriptorId: number) {
    this.assertIds(promocionId, suscriptorId);

    const existing = await this.favoritoRepo.findOne({
      where: {
        promocion: { id: promocionId },
        suscriptor: { id: suscriptorId },
      },
      relations: ['promocion', 'suscriptor'],
    });

    if (existing) {
      await this.favoritoRepo.remove(existing);

      return {
        bookmarked: false,
        message: 'Promoción eliminada de favoritos',
      };
    }

    const favorito = this.favoritoRepo.create({
      promocion: { id: promocionId } as any,
      suscriptor: { id: suscriptorId } as any,
    });

    await this.favoritoRepo.save(favorito);

    return {
      bookmarked: true,
      message: 'Promoción agregada a favoritos',
    };
  }

  async isBookmarked(promocionId: number, suscriptorId: number) {
    this.assertIds(promocionId, suscriptorId);

    const existing = await this.favoritoRepo.findOne({
      where: {
        promocion: { id: promocionId },
        suscriptor: { id: suscriptorId },
      },
    });

    return { bookmarked: !!existing };
  }

  /** Lista completa (con relaciones) — se usa en el tab "Promociones" de Mis Favoritos. */
  async findByUser(suscriptorId: number) {
    if (!Number.isFinite(suscriptorId) || suscriptorId <= 0) {
      throw new BadRequestException('suscriptorId inválido.');
    }

    return this.favoritoRepo.find({
      where: { suscriptor: { id: suscriptorId } },
      relations: [
        'promocion',
        'promocion.sucursal',
        'promocion.sucursal.negocio',
      ],
      order: { fechaCreacion: 'DESC' },
    });
  }

  /** Sólo los ids de promoción — para marcar el corazón lleno en un feed sin pedir todo el detalle. */
  async findPromocionIdsByUser(suscriptorId: number): Promise<number[]> {
    if (!Number.isFinite(suscriptorId) || suscriptorId <= 0) {
      throw new BadRequestException('suscriptorId inválido.');
    }

    const rows = await this.favoritoRepo.find({
      where: { suscriptor: { id: suscriptorId } },
      relations: ['promocion'],
    });

    return rows
      .map((r) => Number(r.promocion?.id))
      .filter((id) => Number.isFinite(id));
  }
}
