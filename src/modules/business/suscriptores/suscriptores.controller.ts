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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SuscriptoresService } from './suscriptores.service';
import { CreateSuscriptorDto } from './dto/create-suscriptor.dto';
import { UpdateSuscriptorDto } from './dto/update-suscriptor.dto';
import { CompletarPerfilDto } from './dto/completar-perfil.dto';

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

  /** ===============================
   *   ELIMINAR SUSCRIPTOR
   *  =============================== */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.suscriptoresService.eliminar(id);
  }
}
