import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as dotenv from 'dotenv';
import { NegociosService } from './negocios.service';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';
import { Express } from 'express'; 

// Cargar variables de entorno
dotenv.config();

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true,
});

console.log('Cloudinary conectado como:', cloudinary.config().cloud_name);

@Controller('negocios')
export class NegociosController {
  constructor(private readonly negociosService: NegociosService) {}

  // Listar todos los negocios
  @Get()
  listar() {
    return this.negociosService.listar();
  }

  // Obtener negocio por ID
  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.negociosService.obtenerPorId(id);
  }

  // Listar negocios por suscriptor
  @Get('suscriptor/:id')
  listarPorSuscriptor(@Param('id', ParseIntPipe) suscriptorId: number) {
    return this.negociosService.listarPorSuscriptor(suscriptorId);
  }

  // Obtener detalle completo
  @Get(':id/detalle')
  async obtenerDetalle(@Param('id', ParseIntPipe) id: number) {
    return this.negociosService.obtenerDetalle(id);
  }

  // Crear negocio con subida directa a Cloudinary (buffer)
  @Post()
  @UseInterceptors(FileInterceptor('logo'))
  async crear(
    @UploadedFile() file: Express.Multer.File, //Express tip importado
    @Body() dto: CreateNegocioDto,
  ) {
    let logoUrl: string | null = null;

    if (file) {
      console.log('Archivo recibido:', file.originalname);

      // Subir a Cloudinary usando buffer (sin guardar en disco)
      const upload = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'jelpy/negocios/logos' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result as UploadApiResponse);
          },
        );
        stream.end(file.buffer);
      });
      

      logoUrl = upload.secure_url;
      console.log('Imagen subida a Cloudinary:', logoUrl);
    } else {
      console.log('No se envió ningún archivo de logo.');
    }

    return this.negociosService.crear({ ...dto, logoUrl });
  }

  // Actualizar datos generales del negocio
  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNegocioDto,
  ) {
    return this.negociosService.actualizar(id, dto);
  }

  // Actualizar solo el logo del negocio
  @Put(':id/logo')
  @UseInterceptors(FileInterceptor('logo'))
  async actualizarLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se envió ninguna imagen.');
    }

    console.log('📸 Archivo recibido para actualizar:', file.originalname);

    const negocio = await this.negociosService.obtenerPorId(id);
    const logoActual = negocio.logoUrl;

    // Subir nuevo logo a Cloudinary
    const upload = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'jelpy/negocios/logos' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result as UploadApiResponse);
        },
      );
      stream.end(file.buffer);
    });
    

    const nuevoLogoUrl = upload.secure_url;
    console.log('Nuevo logo subido:', nuevoLogoUrl);

    // Eliminar logo anterior si existía
    if (logoActual && logoActual.includes('res.cloudinary.com')) {
      try {
        const publicIdMatch = logoActual.match(/\/jelpy\/negocios\/logos\/([^/.]+)/);
        const publicId = publicIdMatch ? `jelpy/negocios/logos/${publicIdMatch[1]}` : null;

        if (publicId) {
          await cloudinary.uploader.destroy(publicId);
          console.log(`Logo anterior eliminado: ${publicId}`);
        }
      } catch (err: any) {
        console.warn('No se pudo eliminar el logo anterior:', err.message);
      }
    }

    negocio.logoUrl = nuevoLogoUrl;
    await this.negociosService.actualizar(id, negocio);

    return {
      success: true,
      message: 'Logo actualizado correctamente.',
      logoUrl: nuevoLogoUrl,
    };
  }

  // Eliminar negocio (eliminado lógico)
  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    const negocio = await this.negociosService.obtenerPorId(id);

    // Eliminar logo de Cloudinary si existe
    if (negocio.logoUrl && negocio.logoUrl.includes('res.cloudinary.com')) {
      try {
        const publicIdMatch = negocio.logoUrl.match(/\/jelpy\/negocios\/logos\/([^/.]+)/);
        const publicId = publicIdMatch ? `jelpy/negocios/logos/${publicIdMatch[1]}` : null;

        if (publicId) {
          await cloudinary.uploader.destroy(publicId);
          console.log(`Logo eliminado de Cloudinary: ${publicId}`);
        }
      } catch (err: any) {
        console.warn('No se pudo eliminar el logo del negocio:', err.message);
      }
    }

    await this.negociosService.eliminar(id);

    return {
      success: true,
      message: 'Negocio eliminado correctamente (eliminado lógico).',
    };
  }
}
