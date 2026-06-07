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
import { memoryStorage } from 'multer';
import { Express } from 'express';

import { CloudinaryService } from '../../../common/cloudinary/cloudinary.service';
import { PromocionesSucursalesService } from './promociones-sucursales.service';
import { CreatePromocionSucursalDto } from './dto/create-promocion-sucursal.dto';
import { UpdatePromocionSucursalDto } from './dto/update-promocion-sucursal.dto';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

@Controller('promociones-sucursales')
export class PromocionesSucursalesController {
  constructor(
    private readonly promoService: PromocionesSucursalesService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // =========================================================
  // CREATE
  // =========================================================
  @Post()
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async crear(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreatePromocionSucursalDto,
  ) {
    if (file) {
      this.validateImageFile(file);
      const upload = await this.cloudinary.uploadBuffer(file.buffer, {
        folder: 'jelpy/promociones',
        resource_type: 'image',
      });
      dto.imagenUrl = upload.secure_url;
    } else {
      dto.imagenUrl = dto.imagenUrl ?? null;
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

  @Get('negocio/:negocioId')
  listarPorNegocio(@Param('negocioId', ParseIntPipe) negocioId: number) {
    return this.promoService.listarPorNegocio(negocioId);
  }

  @Get('sucursal/:sucursalId')
  listarPorSucursal(@Param('sucursalId', ParseIntPipe) sucursalId: number) {
    return this.promoService.listarPorSucursal(sucursalId);
  }

  @Get('activas')
  listarPromocionesActivas(@Query('ciudadId') ciudadId?: number) {
    return this.promoService.listarPromocionesActivas(
      ciudadId ? Number(ciudadId) : undefined,
    );
  }

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

  @Get('resumen')
  obtenerResumen() {
    return this.promoService.obtenerResumenPromociones();
  }

  @Get('estadisticas')
  obtenerEstadisticas() {
    return this.promoService.obtenerEstadisticasPromociones();
  }

  // =========================================================
  // REGISTRAR VISTA / CLIC
  // =========================================================
  @Post(':id/vista')
  registrarVista(@Param('id', ParseIntPipe) id: number) {
    return this.promoService.registrarVista(id);
  }

  @Post(':id/clic')
  registrarClic(@Param('id', ParseIntPipe) id: number) {
    return this.promoService.registrarClic(id);
  }

  // =========================================================
  // UPDATE
  // =========================================================
  @Patch(':id')
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdatePromocionSucursalDto,
  ) {
    if (file) {
      this.validateImageFile(file);

      const actual = await this.promoService.obtenerPorId(id);
      if (actual?.imagenUrl) {
        await this.cloudinary.destroy(actual.imagenUrl);
      }

      const upload = await this.cloudinary.uploadBuffer(file.buffer, {
        folder: 'jelpy/promociones',
        resource_type: 'image',
      });
      dto.imagenUrl = upload.secure_url;
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

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private validateImageFile(file: Express.Multer.File) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Formato de imagen no permitido. Usa JPG, PNG o WEBP.');
    }
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('La imagen excede 5 MB.');
    }
  }
}
