import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SuscriptoresService } from './suscriptores.service';
import { CreateSuscriptorDto } from './dto/create-suscriptor.dto';
import { UpdateSuscriptorDto } from './dto/update-suscriptor.dto';
import { CompletarPerfilDto } from './dto/completar-perfil.dto';
import { DatosFiscalesDto } from './dto/datos-fiscales.dto';
import { UpdatePermisosDto } from './dto/update-permisos.dto';

@Controller('suscriptores')
export class SuscriptoresController {
  constructor(private readonly suscriptoresService: SuscriptoresService) {}

  /** ===============================
   *   LISTAR
   *  =============================== */
  @Get()
  listar() {
    return this.suscriptoresService.listar();
  }

  /** ===============================
   *   OBTENER POR ID
   *  =============================== */
  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.suscriptoresService.obtenerPorId(id);
  }

  /** ====================================================
   *   CREAR SUSCRIPTOR (primer paso — registro inicial)
   *   Ahora solo correo + nombre + ciudad
   *  ==================================================== */
  @Post()
  crear(@Body() dto: CreateSuscriptorDto) {
    return this.suscriptoresService.crear(dto);
  }

  /** ===============================
   *   ACTUALIZAR DESDE EL PANEL
   *  =============================== */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSuscriptorDto,
  ) {
    return this.suscriptoresService.actualizar(id, dto);
  }

  /** =================================================
   *   MARCAR REGISTRO COMPLETO (ADMIN)
   *   No se usa en la app, pero lo dejamos
   *  ================================================= */
  @Put(':id/completar')
  @UseGuards(JwtAuthGuard)
  completar(@Param('id', ParseIntPipe) id: number) {
    return this.suscriptoresService.completarRegistro(id);
  }

  /** =========================================================
   *   COMPLETAR PERFIL (APP MÓVIL)
   *   Ahora incluye:
   *   - teléfono (máximo 2 cuentas)
   *   - membresía obligatoria
   *   - sexo, fechaNacimiento, contraseña
   *  ========================================================= */
  @Put(':id/completar-perfil')
  @UseGuards(JwtAuthGuard)
  completarPerfil(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompletarPerfilDto,
  ) {
    return this.suscriptoresService.completarPerfil(id, dto);
  }

  /** ===============================================================
   *   ELIMINAR PROPIA CUENTA (soft delete via JWT)
   *   DELETE /suscriptores/me
   *   ⚠️  Debe ir ANTES de DELETE :id para que NestJS no interprete
   *       "me" como un ParseIntPipe param
   *  =============================================================== */
  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  eliminarCuenta(@Request() req: any) {
    return this.suscriptoresService.eliminarCuenta(req.user.sub);
  }

  /** ===============================
   *   ELIMINAR SUSCRIPTOR (ADMIN)
   *  =============================== */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.suscriptoresService.eliminar(id);
  }

  // ── Permisos del dispositivo ────────────────────────────────────────────

  /** GET /suscriptores/:id/permisos */
  @Get(':id/permisos')
  @UseGuards(JwtAuthGuard)
  getPermisos(@Param('id', ParseIntPipe) id: number) {
    return this.suscriptoresService.getPermisos(id);
  }

  /** PATCH /suscriptores/:id/permisos */
  @Patch(':id/permisos')
  @UseGuards(JwtAuthGuard)
  updatePermisos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePermisosDto,
  ) {
    return this.suscriptoresService.updatePermisos(id, dto);
  }

  // ── Datos fiscales ──────────────────────────────────────────────────────

  /** GET /suscriptores/:id/datos-fiscales */
  @Get(':id/datos-fiscales')
  @UseGuards(JwtAuthGuard)
  getDatosFiscales(@Param('id', ParseIntPipe) id: number) {
    return this.suscriptoresService.getDatosFiscales(id);
  }

  /** PUT /suscriptores/:id/datos-fiscales */
  @Put(':id/datos-fiscales')
  @UseGuards(JwtAuthGuard)
  updateDatosFiscales(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DatosFiscalesDto,
  ) {
    return this.suscriptoresService.updateDatosFiscales(id, dto);
  }
}
