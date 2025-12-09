import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsuarioPreferencia } from './entities/usuario-preferencias.entity';

@Injectable()
export class UsuarioPreferenciasService {
  constructor(
    @InjectRepository(UsuarioPreferencia)
    private readonly prefRepo: Repository<UsuarioPreferencia>,
  ) {}

  // Registrar o aumentar preferencia
  async registrarPreferencia(
    usuarioId: number,
    categoriaId?: number,
    subcategoriaId?: number,
  ) {
    if (!usuarioId) return;

    const existente = await this.prefRepo.findOne({
      where: {
        usuarioId,
        categoriaId: categoriaId ?? null,
        subcategoriaId: subcategoriaId ?? null,
      },
    });

    if (existente) {
      existente.total_busquedas++;
      existente.ultima_busqueda = new Date();
      return this.prefRepo.save(existente);
    }

    const nuevo = this.prefRepo.create({
      usuarioId,
      categoriaId: categoriaId ?? null,
      subcategoriaId: subcategoriaId ?? null,
      total_busquedas: 1,
    });

    return this.prefRepo.save(nuevo);
  }

  // Obtener preferencias ordenadas
  async obtenerPreferencias(usuarioId: number) {
    return this.prefRepo.find({
      where: { usuarioId },
      order: { total_busquedas: 'DESC' },
    });
  }
}
