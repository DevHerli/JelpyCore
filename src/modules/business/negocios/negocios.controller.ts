import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CloudinaryService } from '../../../common/cloudinary/cloudinary.service';
import { NegociosService } from './negocios.service';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';
import { Express } from 'express';

@Controller('negocios')
export class NegociosController {
  constructor(
    private readonly negociosService: NegociosService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ============================================================
  // CONSULTAS
  // ============================================================

  @Get()
  listar() {
    return this.negociosService.listar();
  }

  @Get('suscriptor/:id')
  listarPorSuscriptor(@Param('id', ParseIntPipe) suscriptorId: number) {
    return this.negociosService.listarPorSuscriptor(suscriptorId);
  }

  @Get(':id/detalle')
  obtenerDetalle(@Param('id', ParseIntPipe) id: number) {
    return this.negociosService.obtenerDetalle(id);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.negociosService.obtenerPorId(id);
  }

  // ============================================================
  // CREAR
  // ============================================================

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('logo', { storage: memoryStorage() }))
  async crear(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateNegocioDto,
  ) {
    let logoUrl: string | null = null;

    if (file) {
      const upload = await this.cloudinary.uploadBuffer(file.buffer, {
        folder: 'jelpy/negocios/logos',
      });
      logoUrl = upload.secure_url;
    }

    return this.negociosService.crear({ ...dto, logoUrl });
  }

  // ============================================================
  // ACTUALIZAR
  // ============================================================

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNegocioDto,
    @Req() req: any,
  ) {
    const esSuperAdmin = this.esSuperAdmin(req.user);
    if (esSuperAdmin) {
      return this.negociosService.actualizarComoAdmin(id, dto);
    }
    return this.negociosService.actualizarComoOwner(id, dto, req.user?.sub ?? req.user?.id);
  }

  @Put(':id/logo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('logo', { storage: memoryStorage() }))
  async actualizarLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No se envió ninguna imagen.');
    }

    const esSuperAdmin = this.esSuperAdmin(req.user);

    // Si no es admin, verificar ownership antes de continuar
    if (!esSuperAdmin) {
      await this.negociosService.actualizarComoOwner(
        id,
        {} as any,
        req.user?.sub ?? req.user?.id,
      );
    }

    const negocio = await this.negociosService.obtenerPorId(id);

    const upload = await this.cloudinary.uploadBuffer(file.buffer, {
      folder: 'jelpy/negocios/logos',
    });
    const nuevoLogoUrl = upload.secure_url;

    if (negocio.logoUrl) {
      await this.cloudinary.destroy(negocio.logoUrl);
    }

    await this.negociosService.actualizarComoAdmin(id, { logoUrl: nuevoLogoUrl } as any);

    return {
      success: true,
      message: 'Logo actualizado correctamente.',
      logoUrl: nuevoLogoUrl,
    };
  }

  // ============================================================
  // ELIMINAR
  // ============================================================

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async eliminar(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const negocio = await this.negociosService.obtenerPorId(id);

    if (negocio.logoUrl) {
      await this.cloudinary.destroy(negocio.logoUrl);
    }

    const esSuperAdmin = this.esSuperAdmin(req.user);
    if (esSuperAdmin) {
      await this.negociosService.eliminarComoAdmin(id);
    } else {
      await this.negociosService.eliminarComoOwner(id, req.user?.sub ?? req.user?.id);
    }

    return {
      success: true,
      message: 'Negocio eliminado correctamente (eliminado lógico).',
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  /** Devuelve true si el token pertenece a un SuperAdmin del panel */
  private esSuperAdmin(user: any): boolean {
    return (
      user?.rol === 'SuperAdmin' ||
      user?.tipo_usuario === 'SuperAdmin' ||
      (Array.isArray(user?.roles) && user.roles.includes('SuperAdmin'))
    );
  }
}
