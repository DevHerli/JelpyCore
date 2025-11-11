import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { SuscriptoresService } from './suscriptores.service';
import { CreateSuscriptorDto } from './dto/create-suscriptor.dto';
import { UpdateSuscriptorDto } from './dto/update-suscriptor.dto';
import { CompletarPerfilDto } from './dto/completar-perfil.dto';

@Controller('suscriptores')
export class SuscriptoresController {
  constructor(private readonly suscriptoresService: SuscriptoresService) {}

  @Get()
  listar() {
    return this.suscriptoresService.listar();
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.suscriptoresService.obtenerPorId(id);
  }

  @Post()
  crear(@Body() dto: CreateSuscriptorDto) {
    return this.suscriptoresService.crear(dto);
  }

  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSuscriptorDto,
  ) {
    return this.suscriptoresService.actualizar(id, dto);
  }

  @Put(':id/completar')
  completar(@Param('id', ParseIntPipe) id: number) {
    return this.suscriptoresService.completarRegistro(id);
  }

  @Put(':id/completar-perfil')
  completarPerfil(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompletarPerfilDto,
  ) {
    return this.suscriptoresService.completarPerfil(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.suscriptoresService.eliminar(id);
  }
}
