import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as dotenv from 'dotenv';
import { Express } from 'express';

import { PromocionesNegociosService } from './promociones-negocios.service';
import { CreatePromotionBusinessDto } from './dtos/create-promotion-business.dto';
import { UpdatePromotionBusinessDto } from './dtos/update-promotion-business.dto';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true,
});

console.log('Cloudinary conectado (PROMOS) como:', cloudinary.config().cloud_name);

@Controller('promociones-negocios')
export class PromocionesNegociosController {
  constructor(private readonly service: PromocionesNegociosService) {}

  @Post()
  @UseInterceptors(FileInterceptor('imagen'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreatePromotionBusinessDto,
  ) {
    if (file) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!allowed.includes(file.mimetype)) {
        throw new BadRequestException('Formato de imagen no permitido. Usa JPG, PNG o WEBP.');
      }

      // Validación size 5MB
      const max = 5 * 1024 * 1024;
      if (file.size > max) {
        throw new BadRequestException('La imagen excede 5MB.');
      }

      const upload = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'jelpy/promociones', 
            resource_type: 'image',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result as UploadApiResponse);
          },
        );
        stream.end(file.buffer);
      });

      dto.imagenUrl = upload.secure_url;
    } else {
      // si no manda imagen no pasa nada
      dto.imagenUrl = dto.imagenUrl || null;
    }

    // ✅ guardo promo con dto ya listo
    return this.service.create(dto);
  }

  // =========================================================
  // GET BY BUSINESS
  // =========================================================
  @Get('negocio/:businessId')
  findByBusiness(@Param('businessId', ParseIntPipe) businessId: number) {
    return this.service.findByBusiness(businessId);
  }

  // =========================================================
  // GET ONE
  // =========================================================
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // =========================================================
  // UPDATE (imagen opcional) Cloudinary (buffer)
  // - Funciona con JSON normal (sin imagen)
  // - Funciona con multipart/form-data (con o sin imagen)
  // =========================================================
  @Patch(':id')
  @UseInterceptors(FileInterceptor('imagen'))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdatePromotionBusinessDto,
  ) {
    // 1) Si viene imagen nueva, primero obtengo la promo actual para borrar anterior (opcional)
    if (file) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!allowed.includes(file.mimetype)) {
        throw new BadRequestException('Formato de imagen no permitido. Usa JPG, PNG o WEBP.');
      }

      const max = 5 * 1024 * 1024;
      if (file.size > max) {
        throw new BadRequestException('La imagen excede 5MB.');
      }

      // (opcional) borrar imagen anterior si era cloudinary
      const actual = await this.service.findOne(id);
      const oldUrl = actual?.imagenUrl;

      const upload = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'jelpy/promociones',
            resource_type: 'image',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result as UploadApiResponse);
          },
        );
        stream.end(file.buffer);
      });

      dto.imagenUrl = upload.secure_url;

      //si quieres borrar el anterior (como en negocios)
      await this.tryDeleteCloudinaryPromo(oldUrl);
    }

    // 2) actualizo normal con dto (incluye imagenUrl si se subió)
    return this.service.update(id, dto);
  }

  // =========================================================
  // DELETE (soft)
  // =========================================================
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  // =========================================================
  // (helper) eliminar imagen anterior en Cloudinary (si aplica)
  // =========================================================
  private async tryDeleteCloudinaryPromo(url?: string | null) {
    if (!url) return;

    // Solo si viene de cloudinary
    if (!url.includes('res.cloudinary.com')) return;

    try {
      // https://res.cloudinary.com/<cloud>/image/upload/v123/jelpy/promociones/abc123.png
      const match = url.match(/\/jelpy\/promociones\/([^/.]+)/);
      const publicId = match ? `jelpy/promociones/${match[1]}` : null;

      if (!publicId) return;

      await cloudinary.uploader.destroy(publicId);
      console.log('🗑️ Promo image deleted:', publicId);
    } catch (err: any) {
      console.warn('No se pudo eliminar la imagen anterior de promo:', err?.message);
    }
  }
}