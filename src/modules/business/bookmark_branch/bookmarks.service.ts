// src/bookmarks/bookmarks.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookmark } from './entities/bookmark.entity';

@Injectable()
export class BookmarksService {
  constructor(
    @InjectRepository(Bookmark)
    private readonly bookmarkRepo: Repository<Bookmark>,
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
      relations: ['sucursal'],
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
}
