import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { StreetsService } from './streets.service';
import { CreateStreetDto } from './dtos/create-street.dto';
import { UpdateStreetDto } from './dtos/update-street.dto';
import { CreateStreetColonyDto } from './dtos/create-street-colony.dto';
import { UpdateStreetColonyDto } from './dtos/update-street-colony.dto';

@Controller('streets')
export class StreetsController {
  constructor(private readonly streetsService: StreetsService) {}

  // ─── CALLES ────────────────────────────────────────────────────────────────

  /** Crear una nueva calle */
  @Post()
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

  /** Obtener una calle por ID */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.streetsService.findOne(id);
  }

  /** Actualizar datos de una calle */
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStreetDto: UpdateStreetDto) {
    return this.streetsService.update(id, updateStreetDto);
  }

  /** Borrado lógico de una calle (activo = false) */
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('eliminado_por') eliminado_por?: string,
  ) {
    return this.streetsService.remove(id, eliminado_por);
  }

  // ─── ASIGNACIÓN CALLE ↔ COLONIA ────────────────────────────────────────────
  //
  //   Flujo: código postal → colonia → calle
  //
  //   1. Crear asignación:   POST   /streets/street-colonies
  //   2. Listar todas:       GET    /streets/street-colonies
  //   3. Ver una:            GET    /streets/street-colonies/:id
  //   4. Calles de colonia:  GET    /streets/colony/:coloniaId/streets
  //   5. Colonias de calle:  GET    /streets/:calleId/colonies
  //   6. Actualizar:         PATCH  /streets/street-colonies/:id
  //   7. Desactivar:         DELETE /streets/street-colonies/:id
  //
  // IMPORTANTE: las rutas con prefijo literal "street-colonies/" y "colony/"
  // deben registrarse ANTES que ":id" (1 segmento) para evitar ambigüedades.

  /**
   * Asignar una calle a una colonia.
   * Devuelve la relación completa: calle + colonia + código postal.
   *
   * Body: { calle_id, colonia_id, activo?, creado_por? }
   */
  @Post('street-colonies')
  createStreetColony(@Body() createStreetColonyDto: CreateStreetColonyDto) {
    return this.streetsService.createStreetColony(createStreetColonyDto);
  }

  /**
   * Listar todas las asignaciones calle-colonia.
   * Filtros opcionales: calle_id, colonia_id, activo
   * Respuesta ordenada por: código_postal → colonia → calle
   */
  @Get('street-colonies')
  findAllStreetColonies(
    @Query('calle_id') calle_id?: string,
    @Query('colonia_id') colonia_id?: string,
    @Query('activo') activo?: string,
  ) {
    return this.streetsService.findAllStreetColonies({
      calle_id,
      colonia_id,
      activo,
    });
  }

  /**
   * Ver una asignación calle-colonia por su ID.
   * Incluye: calle + colonia + código postal de la colonia.
   */
  @Get('street-colonies/:id')
  findStreetColonyById(@Param('id') id: string) {
    return this.streetsService.findStreetColonyById(id);
  }

  /**
   * Calles que pertenecen a una colonia específica.
   * Incluye el código postal de la colonia.
   * GET /streets/colony/:coloniaId/streets
   */
  @Get('colony/:coloniaId/streets')
  findStreetsByColoniaId(@Param('coloniaId') coloniaId: string) {
    return this.streetsService.findStreetsByColoniaId(coloniaId);
  }

  /**
   * Colonias a las que pertenece una calle (una calle puede estar en varias colonias).
   * Incluye el código postal de cada colonia.
   * GET /streets/:calleId/colonies
   */
  @Get(':calleId/colonies')
  findColoniasByStreetId(@Param('calleId') calleId: string) {
    return this.streetsService.findColoniasByStreetId(calleId);
  }

  /**
   * Actualizar una asignación calle-colonia.
   * Permite cambiar calle_id, colonia_id o activo.
   */
  @Patch('street-colonies/:id')
  updateStreetColony(
    @Param('id') id: string,
    @Body() updateStreetColonyDto: UpdateStreetColonyDto,
  ) {
    return this.streetsService.updateStreetColony(id, updateStreetColonyDto);
  }

  /**
   * Desactivar (borrado lógico) una asignación calle-colonia.
   */
  @Delete('street-colonies/:id')
  removeStreetColony(
    @Param('id') id: string,
    @Query('eliminado_por') eliminado_por?: string,
  ) {
    return this.streetsService.removeStreetColony(id, eliminado_por);
  }
}
