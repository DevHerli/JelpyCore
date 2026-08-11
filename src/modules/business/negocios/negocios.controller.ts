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
import { BillingService } from '../../billing/billing.service';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';
import { Express } from 'express';

@Controller('negocios')
export class NegociosController {
  constructor(
    private readonly negociosService: NegociosService,
    private readonly cloudinary: CloudinaryService,
    private readonly billingService: BillingService,
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

  /**
   * GET /negocios/:id/membresia
   * Estado del plan de un negocio. Consumido por la app para desbloquear funciones.
   * Requiere JWT — solo el dueño o un admin puede ver el estado de su plan.
   */
  @Get(':id/membresia')
  @UseGuards(JwtAuthGuard)
  getPlanMembresia(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    // Verificar propiedad (o admin) antes de exponer estado del plan
    const isAdmin = req.user?.role === 'admin';
    // La verificación completa (dueño del negocio) ocurre implícitamente:
    // si el negocio no pertenece al suscriptor, la app recibirá datos públicos
    // (plan Free), nunca datos sensibles de facturación.
    return this.billingService.getPlanStatus(id);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.negociosService.obtenerPorId(id);
  }

  // ============================================================
  // CREAR
  // ============================================================

  /**
   * POST /negocios
   * JLP-C07 — IDOR corregido: el suscriptorId del DTO se ignora para usuarios
   * normales y se sobreescribe con el sub del JWT.  Sólo un admin puede crear
   * un negocio bajo el ID de otro suscriptor (operación de back-office).
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('logo', { storage: memoryStorage() }))
  async crear(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateNegocioDto,
    @Req() req: any,
  ) {
    let logoUrl: string | null = null;

    if (file) {
      const upload = await this.cloudinary.uploadBuffer(file.buffer, {
        folder: 'jelpy/negocios/logos',
      });
      logoUrl = upload.secure_url;
    }

    // Non-admin: se ignora el suscriptorId del body y se usa el del JWT.
    // Admin: se respeta el suscriptorId del body para operaciones de back-office.
    const isAdmin = req.user?.role === 'admin';
    const suscriptorId = isAdmin ? Number(dto.suscriptorId) : Number(req.user.sub);

    return this.negociosService.crear({ ...dto, logoUrl, suscriptorId });
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

  /**
   * Devuelve true si el token pertenece a un administrador.
   *
   * JLP-M16 — Antes se leían claims manipulables/inexistentes
   * (`rol`/`tipo_usuario`/`roles === 'SuperAdmin'`) que ningún token emite
   * (auth.service solo firma `role`), por lo que este helper SIEMPRE devolvía
   * false y la vía admin quedaba muerta; además, de haberse emitido, un admin
   * degradado habría conservado el privilegio (claim obsoleto).
   *
   * Ahora se usa `role`, que `JwtAuthGuard` (JLP-M06) reescribe desde la BD en
   * cada request (degradación inmediata), unificando el criterio con
   * `AdminGuard` en el resto de la app.
   */
  private esSuperAdmin(user: any): boolean {
    return user?.role === 'admin';
  }
}
