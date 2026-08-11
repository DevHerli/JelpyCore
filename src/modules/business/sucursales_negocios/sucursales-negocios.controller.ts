import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
  UploadedFiles,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipe,
  FileTypeValidator,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  SucursalesNegociosService,
  RequesterCtx,
} from './sucursales-negocios.service';
import { CreateSucursalNegocioDto } from './dto/create-sucursal-negocio.dto';
import { UpdateSucursalNegocioDto } from './dto/update-sucursal-negocio.dto';
import { AssignCaracteristicaDto } from '../caracteristicas_sucursales/dtos/assign-caracteristica.dto';
import { SucursalesCaracteristicasService } from '../caracteristicas_sucursales/sucursales-caracteristicas.service';
import { EstadisticasService } from '../../core/metrics/estadisticas/estadisticas.service';

/**
 * SucursalesNegociosController
 *
 * Modelo de autorización (JLP-C10 — corrección de autorización rota):
 *  - GET (navegación pública del catálogo) → sin guard.
 *  - Mutaciones (POST/PUT/DELETE, galería, características) → JwtAuthGuard +
 *    verificación de propiedad `sucursal → negocio → suscriptor` en el servicio.
 *    Los admin (role='admin' en el claim) hacen bypass.
 */
@Controller('sucursales')
export class SucursalesNegociosController {
  constructor(
    private readonly service: SucursalesNegociosService,
    private readonly sucCarService: SucursalesCaracteristicasService,
    private readonly estadisticasService: EstadisticasService,
  ) {}

  /** Construye el contexto de propiedad a partir del JWT verificado. */
  private requester(req: any): RequesterCtx {
    return { sub: Number(req.user?.sub), isAdmin: req.user?.role === 'admin' };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async crear(
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    let imagenUrl = null;

    if (file) {
      try {
        const upload = await new Promise<UploadApiResponse>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'jelpy/sucursales/fachadas' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result as UploadApiResponse);
            },
          );
          stream.end(file.buffer);
        });
        imagenUrl = upload.secure_url;
      } catch (error) {
        console.error('Error subiendo imagen:', error);
      }
    }

    const negocioId = parseInt(body.negocioId);
    const ciudadId = parseInt(body.ciudadId);
    const estadoId = body.estadoId ? parseInt(body.estadoId) : 1;
    const esMatriz = String(body.esMatriz) === 'true';

    let latitud = null;
    if (body.latitud && body.latitud !== 'null' && body.latitud !== '' && !isNaN(Number(body.latitud))) {
      latitud = parseFloat(body.latitud);
    }

    let longitud = null;
    if (body.longitud && body.longitud !== 'null' && body.longitud !== '' && !isNaN(Number(body.longitud))) {
      longitud = parseFloat(body.longitud);
    }

    let rangoPrecios: number | null = null;
    if (body.rangoPrecios !== undefined && body.rangoPrecios !== null && body.rangoPrecios !== '' && body.rangoPrecios !== 'null') {
      const parsed = parseInt(body.rangoPrecios);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 3) {
        rangoPrecios = parsed;
      }
    }

    const datosLimpios = {
      ...body,
      negocioId,
      ciudadId,
      estadoId,
      esMatriz,
      latitud,
      longitud,
      rangoPrecios,
      imagenUrl,
    };

    return this.service.crear(datosLimpios as any, this.requester(req));
  }

  @Post(':id/galeria')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('fotos', 10, { storage: memoryStorage() }))
  async subirGaleria(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }),
        ],
      }),
    )
    files: Express.Multer.File[],
    @Request() req: any,
  ) {
    // Verifica propiedad ANTES de subir a Cloudinary (evita gasto de storage por atacantes).
    await this.service.assertPuedeGestionarSucursal(id, this.requester(req));

    const fotosSubidas = [];

    for (const file of files) {
      const upload = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: `jelpy/sucursales/${id}/galeria` },
          (error, result) => {
            if (error) reject(error);
            else resolve(result as UploadApiResponse);
          },
        );
        stream.end(file.buffer);
      });

      fotosSubidas.push({
        url: upload.secure_url,
        publicId: upload.public_id,
      });
    }

    return this.service.agregarImagenes(id, fotosSubidas, this.requester(req));
  }

  @Get(':id/kpis-light')
  async getKpisLight(@Param('id', ParseIntPipe) id: number) {
    return this.estadisticasService.getKpisSucursal(id);
  }

  @Get('negocio/:negocioId')
  listarPorNegocio(@Param('negocioId', ParseIntPipe) negocioId: number) {
    return this.service.listarPorNegocio(negocioId);
  }

  @Get()
  listar(
    @Query('negocioId') negocioId?: number,
    @Query('ciudadId') ciudadId?: number,
    @Query('estadoId') estadoId?: number,
  ) {
    return this.service.listar({
      negocioId: negocioId ? Number(negocioId) : undefined,
      ciudadId: ciudadId ? Number(ciudadId) : undefined,
      estadoId: estadoId ? Number(estadoId) : undefined,
    });
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtener(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSucursalNegocioDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    // Verifica propiedad ANTES de subir a Cloudinary.
    await this.service.assertPuedeGestionarSucursal(id, this.requester(req));

    let imagenUrl = undefined;

    if (file) {
      const upload = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'jelpy/sucursales/fachadas' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result as UploadApiResponse);
          },
        );
        stream.end(file.buffer);
      });
      imagenUrl = upload.secure_url;
    }

    const datosLimpios: any = { ...dto };
    if (dto.negocioId) datosLimpios.negocioId = Number(dto.negocioId);
    if (dto.ciudadId) datosLimpios.ciudadId = Number(dto.ciudadId);
    if (dto.estadoId) datosLimpios.estadoId = Number(dto.estadoId);
    if (dto.esMatriz !== undefined) datosLimpios.esMatriz = String(dto.esMatriz) === 'true';
    if (dto.rangoPrecios !== undefined) {
      const rp = dto.rangoPrecios;
      if (rp === null || rp === '' as any || rp === 'null' as any) {
        datosLimpios.rangoPrecios = null;
      } else {
        const parsed = Number(rp);
        datosLimpios.rangoPrecios = !isNaN(parsed) && parsed >= 1 && parsed <= 3 ? parsed : null;
      }
    }
    if (imagenUrl) datosLimpios.imagenUrl = imagenUrl;

    return this.service.actualizar(id, datosLimpios, this.requester(req));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  eliminar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.eliminar(id, this.requester(req));
  }

  @Delete('galeria/:imagenId')
  @UseGuards(JwtAuthGuard)
  async eliminarFoto(
    @Param('imagenId', ParseIntPipe) imagenId: number,
    @Request() req: any,
  ) {
    const publicId = await this.service.eliminarImagen(imagenId, this.requester(req));
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
    return { success: true, message: 'Imagen eliminada' };
  }

  @Get(':id/caracteristicas')
  obtenerCaracteristicas(@Param('id', ParseIntPipe) id: number) {
    return this.sucCarService.getBySucursal(id);
  }

  @Post(':id/caracteristicas')
  @UseGuards(JwtAuthGuard)
  async assignCaracteristica(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignCaracteristicaDto,
    @Request() req: any,
  ) {
    await this.service.assertPuedeGestionarSucursal(id, this.requester(req));
    return this.sucCarService.assignCaracteristica(id, dto);
  }
}