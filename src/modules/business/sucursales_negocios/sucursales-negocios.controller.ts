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
  UploadedFiles,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  FileTypeValidator,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { SucursalesNegociosService } from './sucursales-negocios.service';
import { CreateSucursalNegocioDto } from './dto/create-sucursal-negocio.dto';
import { UpdateSucursalNegocioDto } from './dto/update-sucursal-negocio.dto';
import { AssignCaracteristicaDto } from '../caracteristicas_sucursales/dtos/assign-caracteristica.dto';
import { SucursalesCaracteristicasService } from '../caracteristicas_sucursales/sucursales-caracteristicas.service';
import { EstadisticasService } from '../../core/metrics/estadisticas/estadisticas.service';

@Controller('sucursales')
export class SucursalesNegociosController {
  constructor(
    private readonly service: SucursalesNegociosService,
    private readonly sucCarService: SucursalesCaracteristicasService,
    private readonly estadisticasService: EstadisticasService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async crear(
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
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

    const datosLimpios = {
      ...body,
      negocioId,
      ciudadId,
      estadoId,
      esMatriz,
      latitud,
      longitud,
      imagenUrl,
    };

    return this.service.crear(datosLimpios as any);
  }

  @Post(':id/galeria')
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
  ) {
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

    return this.service.agregarImagenes(id, fotosSubidas);
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
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSucursalNegocioDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
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
    if (imagenUrl) datosLimpios.imagenUrl = imagenUrl;

    return this.service.actualizar(id, datosLimpios);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminar(id);
  }

  @Delete('galeria/:imagenId')
  async eliminarFoto(@Param('imagenId', ParseIntPipe) imagenId: number) {
    const publicId = await this.service.eliminarImagen(imagenId);
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
  assignCaracteristica(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignCaracteristicaDto,
  ) {
    return this.sucCarService.assignCaracteristica(id, dto);
  }
}