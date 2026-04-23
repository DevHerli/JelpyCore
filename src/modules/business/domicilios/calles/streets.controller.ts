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

  @Post()
  create(@Body() createStreetDto: CreateStreetDto) {
    return this.streetsService.create(createStreetDto);
  }

  @Get()
  findAll(
    @Query('nombre') nombre?: string,
    @Query('tipo_vialidad') tipo_vialidad?: string,
    @Query('activo') activo?: string,
  ) {
    return this.streetsService.findAll({
      nombre,
      tipo_vialidad,
      activo,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.streetsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStreetDto: UpdateStreetDto) {
    return this.streetsService.update(id, updateStreetDto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('eliminado_por') eliminado_por?: string,
  ) {
    return this.streetsService.remove(id, eliminado_por);
  }

  @Post('street-colonies')
  createStreetColony(@Body() createStreetColonyDto: CreateStreetColonyDto) {
    return this.streetsService.createStreetColony(createStreetColonyDto);
  }

  @Get('street-colonies/all')
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

  @Get('street-colonies/by-id/:id')
  findStreetColonyById(@Param('id') id: string) {
    return this.streetsService.findStreetColonyById(id);
  }

  @Get(':calleId/colonies')
  findColoniasByStreetId(@Param('calleId') calleId: string) {
    return this.streetsService.findColoniasByStreetId(calleId);
  }

  @Get('colony/:coloniaId/streets')
  findStreetsByColoniaId(@Param('coloniaId') coloniaId: string) {
    return this.streetsService.findStreetsByColoniaId(coloniaId);
  }

  @Patch('street-colonies/:id')
  updateStreetColony(
    @Param('id') id: string,
    @Body() updateStreetColonyDto: UpdateStreetColonyDto,
  ) {
    return this.streetsService.updateStreetColony(id, updateStreetColonyDto);
  }

  @Delete('street-colonies/:id')
  removeStreetColony(
    @Param('id') id: string,
    @Query('eliminado_por') eliminado_por?: string,
  ) {
    return this.streetsService.removeStreetColony(id, eliminado_por);
  }
}