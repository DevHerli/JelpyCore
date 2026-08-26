import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../../../common/guards/admin.guard';
import { StreetsService } from './streets.service';
import { CreateStreetDto } from './dtos/create-street.dto';
import { UpdateStreetDto } from './dtos/update-street.dto';
import { CreateStreetColonyDto } from './dtos/create-street-colony.dto';
import { UpdateStreetColonyDto } from './dtos/update-street-colony.dto';

// JLP-H18 — Catálogo maestro: escritura restringida a administradores.
@Controller('streets')
export class StreetsController {
  constructor(private readonly streetsService: StreetsService) {}

  // ─── CALLES ────────────────────────────────────────────────────────────────

  /** Crear una nueva calle */
  @Post()
  @UseGuards(AdminGuard)
  create(@Body() createStreetDto: CreateStreetDto) {
    return this.streetsService.create(createStreetDto);
  }

  /** Listar calles con filtros opcionales */
  @Get()
  findAll(
    @Query('nombre') nombre?: string,
    @Query('tipo_vialidad') tipo_vialidad?: string,
    @Query('activo') activo?: string,
  ) {
    return this.streetsService.findAll({ nombre, tipo_vialidad, activo });
  }

  // ─── ASIGNACIÓN CALLE ↔ COLONIA ────────────────────────────────────────────
  //
  //   Flujo: código postal → colonia → calle
  //
  //   IMPORTANTE: todas las rutas con prefijo literal ("street-colonies",
  //   "colony") deben declararse ANTES que las rutas con parámetro dinámico
  //   (":id", ":calleId") para que NestJS no las capture como parámetros.
  //
  //   Orden correcto:
  //     POST   street-colonies
  //     GET    street-colonies            ← este
  //     GET    street-colonies/:id
  //     GET    colony/:coloniaId/streets
  //     GET    :id                        ← parámetros al final
  //     GET    :calleId/colonies
  //     PATCH  :id
  //     PATCH  street-colonies/:id
  //     DELETE :id
  //     DELETE street-colonies/:id

  /**
   * Asignar una calle a una colonia.
   * Body: { calle_id, colonia_id, activo?, creado_por? }
   */
  @Post('street-colonies')
  @UseGuards(AdminGuard)
  createStreetColony(@Body() createStreetColonyDto: CreateStreetColonyDto) {
    return this.streetsService.createStreetColony(createStreetColonyDto);
  }

  /**
   * Listar todas las asignaciones calle-colonia.
   * Filtros opcionales: calle_id, colonia_id, activo ('1'|'0')
   * Paginación: page (default 1), per_page (default 200, máx recomendado 1000)
   * Solo devuelve registros no eliminados (eliminado_por IS NULL).
   * Ordenados por: código_postal ASC → colonia.nombre ASC → calle.nombre ASC
   */
  @Get('street-colonies')
  findAllStreetColonies(
    @Query('calle_id')   calle_id?: string,
    @Query('colonia_id') colonia_id?: string,
    @Query('activo')     activo?: string,
    @Query('page')       page = '1',
    @Query('per_page')   perPage = '200',
  ) {
    return this.streetsService.findAllStreetColonies({
      calle_id,
      colonia_id,
      activo,
      page:    Math.max(1, Number(page)    || 1),
      perPage: Math.min(1000, Math.max(1, Number(perPage) || 200)),
    });
  }

  /**
   * Ver una asignación calle-colonia por su ID.
   * Incluye: calle + colonia + código postal + ciudad.
   */
  @Get('street-colonies/:id')
  findStreetColonyById(@Param('id') id: string) {
    return this.streetsService.findStreetColonyById(id);
  }

  /**
   * Calles que pertenecen a una colonia específica.
   * GET /streets/colony/:coloniaId/streets
   * GET /streets/colony/:coloniaId/streets?search=juarez  ← filtro opcional por nombre
   *   (case-insensitive, ignora acentos, busca "contiene").
   */
  @Get('colony/:coloniaId/streets')
  findStreetsByColoniaId(
    @Param('coloniaId') coloniaId: string,
    @Query('search') search?: string,
  ) {
    return this.streetsService.findStreetsByColoniaId(coloniaId, search);
  }

  /** Obtener una calle por ID */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.streetsService.findOne(id);
  }

  /**
   * Colonias a las que pertenece una calle (una calle puede estar en varias colonias).
   * GET /streets/:calleId/colonies
   */
  @Get(':calleId/colonies')
  findColoniasByStreetId(@Param('calleId') calleId: string) {
    return this.streetsService.findColoniasByStreetId(calleId);
  }

  /** Actualizar datos de una calle */
  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() updateStreetDto: UpdateStreetDto) {
    return this.streetsService.update(id, updateStreetDto);
  }

  /**
   * Actualizar una asignación calle-colonia.
   * Permite cambiar calle_id, colonia_id o activo.
   */
  @Patch('street-colonies/:id')
  @UseGuards(AdminGuard)
  updateStreetColony(
    @Param('id') id: string,
    @Body() updateStreetColonyDto: UpdateStreetColonyDto,
  ) {
    return this.streetsService.updateStreetColony(id, updateStreetColonyDto);
  }

  /** Borrado lógico de una calle (activo = false) */
  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(
    @Param('id') id: string,
    @Query('eliminado_por') eliminado_por?: string,
  ) {
    return this.streetsService.remove(id, eliminado_por);
  }

  /**
   * Desactivar (borrado lógico) una asignación calle-colonia.
   */
  @Delete('street-colonies/:id')
  @UseGuards(AdminGuard)
  removeStreetColony(
    @Param('id') id: string,
    @Query('eliminado_por') eliminado_por?: string,
  ) {
    return this.streetsService.removeStreetColony(id, eliminado_por);
  }
}
