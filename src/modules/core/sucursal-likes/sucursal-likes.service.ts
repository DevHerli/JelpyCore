import {
    Injectable,
    ConflictException,
    NotFoundException,
  } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';
  import { SucursalLike } from './entities/sucursal-like.entity';
  
  @Injectable()
  export class SucursalLikesService {
    constructor(
      @InjectRepository(SucursalLike)
      private readonly likeRepo: Repository<SucursalLike>,
    ) {}
  
    // ============================================================
    // DAR LIKE
    // ============================================================
    async darLike(usuarioId: number, sucursalId: number) {
      const existe = await this.likeRepo.findOne({
        where: { usuarioId, sucursalId },
      });
  
      if (existe) {
        throw new ConflictException('Ya le diste like a esta sucursal');
      }
  
      const nuevo = this.likeRepo.create({ usuarioId, sucursalId });
      await this.likeRepo.save(nuevo);
  
      // 🔥 Contador actualizado
      const totalLikes = await this.contar(sucursalId);
      return { liked: true, totalLikes };
    }
  
    // ============================================================
    // QUITAR LIKE
    // ============================================================
    async quitarLike(usuarioId: number, sucursalId: number) {
      const existe = await this.likeRepo.findOne({
        where: { usuarioId, sucursalId },
      });
  
      if (!existe) {
        throw new NotFoundException('No tienes like en esta sucursal');
      }
  
      await this.likeRepo.remove(existe);
  
      // 🔥 Contador actualizado
      const totalLikes = await this.contar(sucursalId);
      return { liked: false, totalLikes };
    }
  
    // ============================================================
    // CONTAR (numérico simple)
    // ============================================================
    async contar(sucursalId: number): Promise<number> {
      return this.likeRepo.count({ where: { sucursalId } });
    }
  
    // ============================================================
    // CONTAR PARA AI SERVICE (objeto con totalLikes)
    // ============================================================
    async contarLikesSucursal(sucursalId: number) {
      const total = await this.contar(sucursalId);
      return { sucursalId, totalLikes: total };
    }
  
    // ============================================================
    // CONTAR LIKES EN BATCH (una sola query GROUP BY)
    // ============================================================
    async contarLikesBatch(sucursalIds: number[]): Promise<Map<number, number>> {
      const result = new Map<number, number>();
      if (!sucursalIds || sucursalIds.length === 0) return result;

      const rows = await this.likeRepo
        .createQueryBuilder('l')
        .select('l.sucursalId', 'sucursalId')
        .addSelect('COUNT(l.id)', 'total')
        .where('l.sucursalId IN (:...ids)', { ids: sucursalIds })
        .groupBy('l.sucursalId')
        .getRawMany();

      for (const row of rows) {
        result.set(Number(row.sucursalId), Number(row.total));
      }
      return result;
    }

    // ============================================================
    // ¿USUARIO YA DIO LIKE?
    // ============================================================
    async usuarioHaDadoLike(usuarioId: number, sucursalId: number) {
      const existe = await this.likeRepo.findOne({
        where: { usuarioId, sucursalId },
      });
      return !!existe;
    }
  }
  