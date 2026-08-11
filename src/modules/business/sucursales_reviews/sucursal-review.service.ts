import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SucursalReview } from './entities/sucursal-review.entity';
import { CreateSucursalReviewDto } from './dtos/create-sucursal-review.dto';
import { UpdateSucursalReviewDto } from './dtos/update-sucursal-review.dto';
import { Suscriptor } from '../suscriptores/entities/suscriptores.entity';

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
  ) {}


  // Crear reseña — la autoría (suscriptorId) proviene del token, no del body.
async create(dto: CreateSucursalReviewDto, suscriptorId: number) {
  const existe = await this.reviewRepo.findOne({
    where: {
      sucursal: { id: dto.sucursalId },
      suscriptor: { id: suscriptorId },
    },
  });

  if (existe) {
    throw new BadRequestException(
      'Ya has dejado una reseña en esta sucursal',
    );
  }

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

  const LIMITE_HORAS = 24;

  const limite = new Date(review.fechaCreacion);
  limite.setHours(limite.getHours() + LIMITE_HORAS);

  if (new Date() > limite) {
    throw new BadRequestException(
      'Solo puedes editar tu reseña dentro de las primeras 24 horas',
    );
  }

  if (review.respuestaNegocio) {
    throw new BadRequestException(
      'No puedes editar una reseña que ya fue respondida por el negocio',
    );
  }

  Object.assign(review, dto);

  return this.reviewRepo.save(review);
}


async findBySucursal(sucursalId: number) {
  return this.reviewRepo.find({
    where: {
      sucursal: { id: sucursalId },
      estado: 'publicada', 
    },
    order: { fechaCreacion: 'DESC' },
  });
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
