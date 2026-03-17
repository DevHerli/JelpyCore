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
import { ColoniasService } from './colonias.service';
import { CreateColoniaDto } from './dtos/create-colonia.dto';
import { UpdateColoniaDto } from './dtos/update-colonia.dto';

@Controller('colonias')
export class ColoniasController {
  constructor(private readonly coloniasService: ColoniasService) {}

  @Post()
  create(@Body() createColoniaDto: CreateColoniaDto) {
    return this.coloniasService.create(createColoniaDto);
  }

  @Get()
  findAll(
    @Query('codigo_postal_id') codigo_postal_id?: string,
    @Query('ciudad_id') ciudad_id?: string,
    @Query('nombre') nombre?: string,
    @Query('activo') activo?: string,
  ) {
    return this.coloniasService.findAll({
      codigo_postal_id,
      ciudad_id,
      nombre,
      activo,
    });
  }

  @Get('postal-code-id/:codigoPostalId')
  findByPostalCodeId(@Param('codigoPostalId') codigoPostalId: string) {
    return this.coloniasService.findByPostalCodeId(codigoPostalId);
  }

  @Get('postal-code/:codigoPostal')
  findByPostalCode(@Param('codigoPostal') codigoPostal: string) {
    return this.coloniasService.findByPostalCode(codigoPostal);
  }

  @Get('city/:ciudadId')
  findByCity(@Param('ciudadId') ciudadId: string) {
    return this.coloniasService.findByCity(ciudadId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coloniasService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateColoniaDto: UpdateColoniaDto) {
    return this.coloniasService.update(id, updateColoniaDto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('eliminado_por') eliminado_por?: string,
  ) {
    return this.coloniasService.remove(id, eliminado_por);
  }
}