/**
 * SuscriptoresController
 *
 * Modelo de autorización:
 *  - POST /suscriptores                     → público (registro inicial)
 *  - GET  /suscriptores                     → AdminGuard (listado sensible)
 *  - GET  /suscriptores/:id                 → JwtAuthGuard + propiedad o admin
 *  - PUT  /suscriptores/:id                 → JwtAuthGuard + propiedad o admin
 *  - PUT  /suscriptores/:id/completar       → AdminGuard (operación administrativa)
 *  - PUT  /suscriptores/:id/completar-perfil→ JwtAuthGuard + propiedad estricta
 *  - DELETE /suscriptores/me               → JwtAuthGuard (auto-eliminación)
 *  - DELETE /suscriptores/:id              → AdminGuard (eliminación administrativa)
 *  - GET/PATCH /suscriptores/:id/permisos  → JwtAuthGuard + propiedad
 *  - GET/PUT  /suscriptores/:id/datos-fiscales → JwtAuthGuard + propiedad
 *
 * JLP-C01 — select:false en entidad protege contrasena/refreshToken automáticamente.
 * JLP-C02 — PUT/:id verifica req.user.sub === id (o admin).
 * JLP-C03 — DELETE/:id sólo accesible con AdminGuard.
 * JLP-C04 — completar-perfil verifica propiedad estricta antes de emitir token.
 * JLP-H05 — permisos y datos-fiscales verifican propiedad.
 */
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { SuscriptoresService } from './suscriptores.service';
import { CreateSuscriptorDto } from './dto/create-suscriptor.dto';
import { UpdateSuscriptorDto } from './dto/update-suscriptor.dto';
import { CompletarPerfilDto } from './dto/completar-perfil.dto';
import { DatosFiscalesDto } from './dto/datos-fiscales.dto';
import { UpdatePermisosDto } from './dto/update-permisos.dto';
import { CambiarContrasenaDto } from './dto/cambiar-contrasena.dto';

@Controller('suscriptores')
export class SuscriptoresController {
  constructor(private readonly suscriptoresService: SuscriptoresService) {}

  /**
   * Verifica que el sub del JWT coincida con el :id de la URL.
   * Los administradores (role='admin', verificado en BD por JwtAuthGuard) siempre pasan.
   * Lanza ForbiddenException si no hay coincidencia.
   */
  private assertOwnership(req: any, targetId: number): void {
    const sub     = Number(req.user?.sub);
    const isAdmin = req.user?.role === 'admin';

    if (!sub || (sub !== targetId && !isAdmin)) {
      throw new ForbiddenException('Solo puedes gestionar tu propia cuenta.');
    }
  }

  // ── Listado (admin) ──────────────────────────────────────────────────────

  /**
   * GET /suscriptores
   * Solo administradores. Nunca público — expone datos de todos los usuarios.
   * JLP-C01: select:false en entidad ya excluye contrasena/refreshToken.
   */
  @Get()
  @UseGuards(AdminGuard)
  listar() {
    return this.suscriptoresService.listar();
  }

  // ── Obtener por ID ───────────────────────────────────────────────────────

  /**
   * GET /suscriptores/:id
   * Requiere JWT válido y propiedad de la cuenta (o rol admin).
   * JLP-C01/C02: guard + propiedad.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  obtener(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    this.assertOwnership(req, id);
    return this.suscriptoresService.obtenerPorId(id);
  }

  // ── Crear (público — registro inicial) ───────────────────────────────────

  /**
   * POST /suscriptores
   * Ruta pública — primer paso del registro por email.
   */
  @Post()
  crear(@Body() dto: CreateSuscriptorDto) {
    return this.suscriptoresService.crear(dto);
  }

  // ── Actualizar perfil ────────────────────────────────────────────────────

  /**
   * PUT /suscriptores/:id
   * Requiere JWT válido y propiedad (o admin).
   * JLP-C02: IDOR corregido — el sub del JWT debe coincidir con :id.
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSuscriptorDto,
    @Request() req: any,
  ) {
    this.assertOwnership(req, id);
    return this.suscriptoresService.actualizar(id, dto);
  }

  // ── Completar registro (admin) ───────────────────────────────────────────

  /**
   * PUT /suscriptores/:id/completar
   * Operación administrativa — marca registro como completo.
   * JLP-C03 pattern: solo admin.
   */
  @Put(':id/completar')
  @UseGuards(AdminGuard)
  completar(@Param('id', ParseIntPipe) id: number) {
    return this.suscriptoresService.completarRegistro(id);
  }

  // ── Completar perfil (app móvil) ─────────────────────────────────────────

  /**
   * PUT /suscriptores/:id/completar-perfil
   * Propiedad ESTRICTA: un usuario solo puede completar SU PROPIO perfil.
   * No se permite bypass de admin porque emite un token firmado con sub=id.
   * JLP-C04: corregido — se verifica sub antes de emitir el token.
   */
  @Put(':id/completar-perfil')
  @UseGuards(JwtAuthGuard)
  completarPerfil(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompletarPerfilDto,
    @Request() req: any,
  ) {
    if (Number(req.user?.sub) !== id) {
      throw new ForbiddenException('Solo puedes completar tu propio perfil.');
    }
    return this.suscriptoresService.completarPerfil(id, dto);
  }

  // ── Eliminación propia (soft delete via JWT) ─────────────────────────────

  /**
   * DELETE /suscriptores/me
   * ⚠️ Debe ir ANTES de DELETE :id — NestJS evalúa rutas en orden de
   *    declaración y "me" sería interpretado como ParseIntPipe si va después.
   */
  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  eliminarCuenta(@Request() req: any) {
    return this.suscriptoresService.eliminarCuenta(req.user.sub);
  }

  // ── Cambio de contraseña (propia cuenta, vía JWT) ────────────────────────

  /**
   * PUT /suscriptores/me/password
   * Requiere JWT válido; el id se toma de req.user.sub, nunca del body.
   * El flujo de "olvidé mi contraseña" (OTP por correo) sigue existiendo
   * como fallback en /auth y no se modifica.
   * Rate limit: 5 intentos / 15 min por usuario — evita fuerza bruta sobre
   * `contrasenaActual`.
   */
  @Put('me/password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 900 } })
  cambiarContrasena(@Body() dto: CambiarContrasenaDto, @Request() req: any) {
    return this.suscriptoresService.cambiarContrasena(req.user.sub, dto);
  }

  // ── Eliminación administrativa ───────────────────────────────────────────

  /**
   * DELETE /suscriptores/:id
   * JLP-C03: solo administradores. AdminGuard verifica role en BD.
   */
  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.suscriptoresService.eliminar(id);
  }

  // ── Permisos del dispositivo ─────────────────────────────────────────────

  /**
   * GET /suscriptores/:id/permisos
   * JLP-H05: solo el propio usuario (o admin) puede leer sus permisos.
   */
  @Get(':id/permisos')
  @UseGuards(JwtAuthGuard)
  getPermisos(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    this.assertOwnership(req, id);
    return this.suscriptoresService.getPermisos(id);
  }

  /**
   * PATCH /suscriptores/:id/permisos
   * JLP-H05: solo el propio usuario (o admin) puede modificar sus permisos.
   */
  @Patch(':id/permisos')
  @UseGuards(JwtAuthGuard)
  updatePermisos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePermisosDto,
    @Request() req: any,
  ) {
    this.assertOwnership(req, id);
    return this.suscriptoresService.updatePermisos(id, dto);
  }

  // ── Datos fiscales ───────────────────────────────────────────────────────

  /**
   * GET /suscriptores/:id/datos-fiscales
   * JLP-H05: solo el propio usuario (o admin) puede leer su RFC y datos fiscales.
   */
  @Get(':id/datos-fiscales')
  @UseGuards(JwtAuthGuard)
  getDatosFiscales(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    this.assertOwnership(req, id);
    return this.suscriptoresService.getDatosFiscales(id);
  }

  /**
   * PUT /suscriptores/:id/datos-fiscales
   * JLP-H05: solo el propio usuario (o admin) puede actualizar su información fiscal.
   */
  @Put(':id/datos-fiscales')
  @UseGuards(JwtAuthGuard)
  updateDatosFiscales(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DatosFiscalesDto,
    @Request() req: any,
  ) {
    this.assertOwnership(req, id);
    return this.suscriptoresService.updateDatosFiscales(id, dto);
  }
}
