import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Patch,
  Delete,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as dotenv from 'dotenv';
import { Express } from 'express';

import { PromocionesSucursalesService } from './promociones-sucursales.service';
import { CreatePromocionSucursalDto } from './dto/create-promocion-sucursal.dto';
import { UpdatePromocionSucursalDto } from './dto/update-promocion-sucursal.dto';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true,
});

@Controller('promociones-sucursales')
export class PromocionesSucursalesController {
  constructor(private readonly promoService: PromocionesSucursalesService) {}

  // =========================================================
  // CREATE
  // =========================================================
  @Post()
  @UseInterceptors(FileInterceptor('imagen'))
  async crear(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreatePromocionSucursalDto,
  ) {
    if (file) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

      if (!allowed.includes(file.mimetype)) {
        throw new BadRequestException(
          'Formato de imagen no permitido. Usa JPG, PNG o WEBP.',
        );
      }

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
      dto.imagenUrl = dto.imagenUrl || null;
    }

    return this.promoService.crear(dto);
  }

  // =========================================================
  // GET ALL
  // =========================================================
  @Get()
  listar() {
    return this.promoService.listar();
  }

  // =========================================================
  // GET POR NEGOCIO
  // =========================================================
  @Get('negocio/:negocioId')
  listarPorNegocio(@Param('negocioId', ParseIntPipe) negocioId: number) {
    return this.promoService.listarPorNegocio(negocioId);
  }

  // =========================================================
  // GET POR SUCURSAL
  // =========================================================
  @Get('sucursal/:sucursalId')
  listarPorSucursal(@Param('sucursalId', ParseIntPipe) sucursalId: number) {
    return this.promoService.listarPorSucursal(sucursalId);
  }

  // =========================================================
  // ACTIVAS
  // =========================================================
  @Get('activas')
  listarPromocionesActivas(@Query('ciudadId') ciudadId?: number) {
    return this.promoService.listarPromocionesActivas(
      ciudadId ? Number(ciudadId) : undefined,
    );
  }

  // =========================================================
  // ACTIVAS FILTRADAS
  // =========================================================
  @Get('activas/filtradas')
  listarPromocionesActivasFiltradas(
    @Query('ciudadId') ciudadId?: number,
    @Query('categoriaId') categoriaId?: number,
    @Query('subcategoriaId') subcategoriaId?: number,
  ) {
    return this.promoService.listarPromocionesActivasFiltradas(
      ciudadId ? Number(ciudadId) : undefined,
      categoriaId ? Number(categoriaId) : undefined,
      subcategoriaId ? Number(subcategoriaId) : undefined,
    );
  }

  // =========================================================
  // PRÓXIMAS
  // =========================================================
  @Get('proximas')
  listarPromocionesProximas(
    @Query('ciudadId') ciudadId?: number,
    @Query('categoriaId') categoriaId?: number,
    @Query('subcategoriaId') subcategoriaId?: number,
  ) {
    return this.promoService.listarPromocionesProximas(
      ciudadId ? Number(ciudadId) : undefined,
      categoriaId ? Number(categoriaId) : undefined,
      subcategoriaId ? Number(subcategoriaId) : undefined,
    );
  }

  // =========================================================
  // FINALIZADAS
  // =========================================================
  @Get('finalizadas')
  listarPromocionesFinalizadas(
    @Query('ciudadId') ciudadId?: number,
    @Query('categoriaId') categoriaId?: number,
    @Query('subcategoriaId') subcategoriaId?: number,
  ) {
    return this.promoService.listarPromocionesFinalizadas(
      ciudadId ? Number(ciudadId) : undefined,
      categoriaId ? Number(categoriaId) : undefined,
      subcategoriaId ? Number(subcategoriaId) : undefined,
    );
  }

  // =========================================================
  // RESUMEN
  // =========================================================
  @Get('resumen')
  obtenerResumen() {
    return this.promoService.obtenerResumenPromociones();
  }

  // =========================================================
  // ESTADÍSTICAS
  // =========================================================
  @Get('estadisticas')
  obtenerEstadisticas() {
    return this.promoService.obtenerEstadisticasPromociones();
  }

  // =========================================================
  // REGISTRAR VISTA
  // =========================================================
  @Post(':id/vista')
  async registrarVista(@Param('id', ParseIntPipe) id: number) {
    return this.promoService.registrarVista(id);
  }

  // =========================================================
  // REGISTRAR CLIC
  // =========================================================
  @Post(':id/clic')
  async registrarClic(@Param('id', ParseIntPipe) id: number) {
    return this.promoService.registrarClic(id);
  }

  // =========================================================
  // UPDATE
  // =========================================================
  @Patch(':id')
  @UseInterceptors(FileInterceptor('imagen'))
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdatePromocionSucursalDto,
  ) {
    if (file) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

      if (!allowed.includes(file.mimetype)) {
        throw new BadRequestException(
          'Formato de imagen no permitido. Usa JPG, PNG o WEBP.',
        );
      }

      const max = 5 * 1024 * 1024;

      if (file.size > max) {
        throw new BadRequestException('La imagen excede 5MB.');
      }

      const actual = await this.promoService.obtenerPorId(id);
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

      await this.tryDeleteCloudinaryPromo(oldUrl);
    }

    return this.promoService.actualizar(id, dto);
  }

  // =========================================================
  // DELETE
  // =========================================================
  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.promoService.eliminar(id);
  }

  // =========================================================
  // CLOUDINARY DELETE
  // =========================================================
  private async tryDeleteCloudinaryPromo(url?: string | null) {
    if (!url) return;

    if (!url.includes('res.cloudinary.com')) return;

    try {
      const match = url.match(/\/jelpy\/promociones\/([^/.]+)/);
      const publicId = match ? `jelpy/promociones/${match[1]}` : null;

      if (!publicId) return;

      await cloudinary.uploader.destroy(publicId);
    } catch (err: any) {
      console.warn(
        'No se pudo eliminar la imagen anterior de promo:',
        err?.message,
      );
    }
  }
}