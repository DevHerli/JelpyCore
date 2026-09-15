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
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Express } from 'express';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CloudinaryService } from '../../../common/cloudinary/cloudinary.service';
import {
  PromocionesSucursalesService,
  RequesterCtx,
} from './promociones-sucursales.service';
import { CreatePromocionSucursalDto } from './dto/create-promocion-sucursal.dto';
import { UpdatePromocionSucursalDto } from './dto/update-promocion-sucursal.dto';
import { TrackPromocionEventoDto } from './dto/track-promocion-evento.dto';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * JLP-C11 — Mutaciones protegidas con JwtAuthGuard + propiedad de la sucursal
 * (verificada en el servicio). Los GET de catálogo se mantienen públicos.
 */
@Controller('promociones-sucursales')
export class PromocionesSucursalesController {
  constructor(
    private readonly promoService: PromocionesSucursalesService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private requester(req: any): RequesterCtx {
    return { sub: Number(req.user?.sub), isAdmin: req.user?.role === 'admin' };
  }

  // =========================================================
  // CREATE
  // =========================================================
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async crear(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreatePromocionSucursalDto,
    @Request() req: any,
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

    return this.promoService.crear(dto, this.requester(req));
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

  // METRICS-002: métricas reales agregadas de TODAS las sucursales del
  // negocio — alimenta la sección "Promociones Globales" del negocio.
  @Get('negocio/:negocioId/metricas')
  @UseGuards(JwtAuthGuard)
  obtenerMetricasNegocio(
    @Param('negocioId', ParseIntPipe) negocioId: number,
    @Request() req: any,
  ) {
    return this.promoService.obtenerMetricasNegocio(negocioId, this.requester(req));
  }

  @Get('sucursal/:sucursalId')
  listarPorSucursal(@Param('sucursalId', ParseIntPipe) sucursalId: number) {
    return this.promoService.listarPorSucursal(sucursalId);
  }

  // METRICS-002: métricas reales (vistas/alcanzados/conversiones) de una
  // sucursal — alimenta app-branch-promotion-section en branch-detail.
  // Sólo el dueño de la sucursal (o admin) puede verlas.
  @Get('sucursal/:sucursalId/metricas')
  @UseGuards(JwtAuthGuard)
  obtenerMetricasSucursal(
    @Param('sucursalId', ParseIntPipe) sucursalId: number,
    @Request() req: any,
  ) {
    return this.promoService.obtenerMetricasSucursal(sucursalId, this.requester(req));
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

  // METRICS-002: tracking real de descubrimiento/interacción con una
  // promoción (vista/conversión). Público/anónimo por diseño (igual que
  // /vista y /clic arriba, y que EstadisticasController.registrarEvento) —
  // se mitiga con rate-limit, no con auth.
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Post(':id/evento')
  registrarEventoPromocion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TrackPromocionEventoDto,
  ) {
    return this.promoService.registrarEventoPromocion(id, dto);
  }

  // =========================================================
  // UPDATE
  // =========================================================
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdatePromocionSucursalDto,
    @Request() req: any,
  ) {
    const requester = this.requester(req);

    if (file) {
      this.validateImageFile(file);

      // Verifica propiedad ANTES de tocar Cloudinary (evita gasto por atacantes).
      await this.promoService.assertPuedeGestionarPromocion(id, requester);

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

    return this.promoService.actualizar(id, dto, requester);
  }

  // =========================================================
  // DELETE
  // =========================================================
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  eliminar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.promoService.eliminar(id, this.requester(req));
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
