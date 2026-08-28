import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SucursalReview } from './entities/sucursal-review.entity';
import { SucursalReviewReaccion } from './entities/sucursal-review-reaccion.entity';
import { CreateSucursalReviewDto } from './dtos/create-sucursal-review.dto';
import { UpdateSucursalReviewDto } from './dtos/update-sucursal-review.dto';
import { Suscriptor } from '../suscriptores/entities/suscriptores.entity';

export type ReaccionTipo = 'like' | 'dislike';

// JLP-H20 — Identidad y autoridad de reseñas:
//  · La autoría se toma del token, nunca del body (evita spoofing).
//  · Responder una reseña queda restringido al dueño del negocio (o admin).
//  · La moderación de estado la controla AdminGuard en el controlador.
export type RequesterCtx = { sub: number; isAdmin: boolean };

@Injectable()
export class SucursalReviewService {
  constructor(
    @InjectRepository(SucursalReview)
    private readonly reviewRepo: Repository<SucursalReview>,

    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,

    @InjectRepository(SucursalReviewReaccion)
    private readonly reaccionRepo: Repository<SucursalReviewReaccion>,
  ) {}


  // Crear reseña — la autoría (suscriptorId) proviene del token, no del body.
async create(dto: CreateSucursalReviewDto, suscriptorId: number) {
  // Opción B: un suscriptor puede dejar múltiples reseñas en la misma
  // sucursal, sin límite. No se valida la existencia de una reseña previa.

  const suscriptor = await this.suscriptorRepo.findOne({
    where: { id: suscriptorId },
  });

  if (!suscriptor) {
    throw new BadRequestException('Suscriptor no encontrado');
  }

  const nombreMostrado = `${suscriptor.nombre} ${suscriptor.apellidoPaterno}`;

  const review = this.reviewRepo.create({
    rating: dto.rating,
    comentario: dto.comentario,
    nombreMostrado,
    estado: 'publicada',
    sucursal: { id: dto.sucursalId } as any,
    suscriptor: suscriptor,
    respuestaNegocio: null,
    fechaRespuesta: null,
  });

  return this.reviewRepo.save(review);
}



async responderReview(
  reviewId: number,
  respuesta: string,
  requester?: RequesterCtx,
) {
  const review = await this.reviewRepo.findOne({
    where: { id: reviewId },
    relations: ['sucursal', 'sucursal.negocio', 'sucursal.negocio.suscriptor'],
  });

  if (!review) {
    throw new BadRequestException('Reseña no encontrada');
  }

  // Solo el dueño del negocio (o un admin) puede responder.
  if (requester && !requester.isAdmin) {
    const ownerId = Number(review.sucursal?.negocio?.suscriptor?.id);
    if (!ownerId || ownerId !== Number(requester.sub)) {
      throw new ForbiddenException(
        'No tienes permiso para responder esta reseña',
      );
    }
  }

  review.respuestaNegocio = respuesta;
  review.fechaRespuesta = new Date();

  return this.reviewRepo.save(review);
}


async update(
  reviewId: number,
  suscriptorId: number,
  dto: UpdateSucursalReviewDto,
) {
  const review = await this.reviewRepo.findOne({
    where: {
      id: reviewId,
      suscriptor: { id: suscriptorId },
    },
  });

  if (!review) {
    throw new BadRequestException(
      'Reseña no encontrada o no tienes permisos para editarla',
    );
  }

  // Opción B: sin límite de tiempo para editar la propia reseña.

  if (review.respuestaNegocio) {
    throw new BadRequestException(
      'No puedes editar una reseña que ya fue respondida por el negocio',
    );
  }

  Object.assign(review, dto);

  return this.reviewRepo.save(review);
}


async findBySucursal(sucursalId: number) {
  const reviews = await this.reviewRepo.find({
    where: {
      sucursal: { id: sucursalId },
      estado: 'publicada',
    },
    order: { fechaCreacion: 'DESC' },
  });

  if (!reviews.length) return reviews;

  // Conteo de likes/dislikes por reseña, en una sola consulta agrupada.
  const ids = reviews.map((r) => r.id);
  const counts = await this.reaccionRepo
    .createQueryBuilder('rx')
    .select('rx.resenaId', 'resenaId')
    .addSelect("SUM(CASE WHEN rx.tipo = 'like' THEN 1 ELSE 0 END)", 'likes')
    .addSelect("SUM(CASE WHEN rx.tipo = 'dislike' THEN 1 ELSE 0 END)", 'dislikes')
    .where('rx.resenaId IN (:...ids)', { ids })
    .groupBy('rx.resenaId')
    .getRawMany();

  const map = new Map<number, { likes: number; dislikes: number }>(
    counts.map((c) => [
      Number(c.resenaId),
      { likes: Number(c.likes) || 0, dislikes: Number(c.dislikes) || 0 },
    ]),
  );

  return reviews.map((r) => ({
    ...r,
    likes: map.get(r.id)?.likes ?? 0,
    dislikes: map.get(r.id)?.dislikes ?? 0,
  }));
}


// ── REACCIONES (like / dislike) ────────────────────────────────────────────

// Alterna la reacción del suscriptor sobre una reseña:
//  · sin reacción previa   → la crea
//  · misma reacción        → la elimina (toggle off)
//  · reacción contraria    → la cambia (like ⇄ dislike)
// Devuelve los conteos actualizados y la reacción vigente del usuario.
async reaccionar(
  resenaId: number,
  suscriptorId: number,
  tipo: ReaccionTipo,
) {
  const review = await this.reviewRepo.findOne({ where: { id: resenaId } });
  if (!review) {
    throw new BadRequestException('Reseña no encontrada');
  }

  const existente = await this.reaccionRepo.findOne({
    where: { resenaId, suscriptorId },
  });

  if (existente) {
    if (existente.tipo === tipo) {
      await this.reaccionRepo.remove(existente);
    } else {
      existente.tipo = tipo;
      await this.reaccionRepo.save(existente);
    }
  } else {
    await this.reaccionRepo.save(
      this.reaccionRepo.create({ resenaId, suscriptorId, tipo }),
    );
  }

  return this.getReaccionEstado(resenaId, suscriptorId);
}

// Conteos de una reseña + la reacción vigente del suscriptor consultante.
private async getReaccionEstado(resenaId: number, suscriptorId: number) {
  const [likes, dislikes, mia] = await Promise.all([
    this.reaccionRepo.count({ where: { resenaId, tipo: 'like' } }),
    this.reaccionRepo.count({ where: { resenaId, tipo: 'dislike' } }),
    this.reaccionRepo.findOne({ where: { resenaId, suscriptorId } }),
  ]);

  return { likes, dislikes, miReaccion: mia?.tipo ?? null };
}

// Reacciones del suscriptor sobre TODAS las reseñas de una sucursal, para
// pintar el estado activo al cargar la lista (el GET de reseñas es público).
async misReaccionesPorSucursal(sucursalId: number, suscriptorId: number) {
  const rows = await this.reaccionRepo
    .createQueryBuilder('rx')
    .innerJoin(SucursalReview, 'r', 'r.id = rx.resenaId')
    .where('r.sucursal_id = :sucursalId', { sucursalId })
    .andWhere('rx.suscriptorId = :suscriptorId', { suscriptorId })
    .select('rx.resenaId', 'resenaId')
    .addSelect('rx.tipo', 'tipo')
    .getRawMany();

  return rows.map((x) => ({
    resenaId: Number(x.resenaId),
    tipo: x.tipo as ReaccionTipo,
  }));
}


  // Promedio de rating
  async getRatingSummary(sucursalId: number) {
    const result = await this.reviewRepo
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'promedio')
      .addSelect('COUNT(*)', 'total')
      .where('r.sucursal_id = :id', { id: sucursalId })
      .andWhere('r.estado = :estado', { estado: 'publicada' })
      .getRawOne();

    return {
      promedio: Number(result.promedio || 0).toFixed(1),
      total: Number(result.total || 0),
    };
  }


async findByNegocio(negocioId: number) {
  const reviews = await this.reviewRepo
    .createQueryBuilder('review')
    .leftJoinAndSelect('review.sucursal', 'sucursal')
    .leftJoinAndSelect('sucursal.negocio', 'negocio')
    .where('negocio.id = :negocioId', { negocioId })
    .andWhere('review.estado = :estado', { estado: 'publicada' })
    .orderBy('review.fechaCreacion', 'DESC')
    .getMany();

  return reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comentario: review.comentario,
    nombreMostrado: review.nombreMostrado,
    respuestaNegocio: review.respuestaNegocio,
    fechaRespuesta: review.fechaRespuesta,
    fechaCreacion: review.fechaCreacion,
    sucursalId: review.sucursal?.id,
    sucursalNombre: review.sucursal?.nombreSucursal || 'Sucursal',
  }));
}


async updateEstado(
  reviewId: number,
  estado: 'pendiente' | 'publicada' | 'rechazada',
) {
  const review = await this.reviewRepo.findOne({
    where: { id: reviewId },
  });

  if (!review) {
    throw new BadRequestException('Reseña no encontrada');
  }

  review.estado = estado;
  review.fechaActualizacion = new Date();

  return this.reviewRepo.save(review);
}



}
