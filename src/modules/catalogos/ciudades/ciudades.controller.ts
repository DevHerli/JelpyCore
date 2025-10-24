import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CiudadesService } from './ciudades.service';
import { CreateCiudadDto } from './dtos/create-ciudad.dto';
import { UpdateCiudadDto } from './dtos/update-ciudad.dto';

@Controller('ciudades')
export class CiudadesController {
  constructor(private readonly ciudadesService: CiudadesService) {}

  @Get()
  listar(@Query('nombre') nombre?: string) {
    if (nombre) {
      return this.ciudadesService.buscarPorNombre(nombre);
    }
    return this.ciudadesService.listar();
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.ciudadesService.obtenerPorId(id);
  }

  @Post()
  crear(@Body() body: CreateCiudadDto) {
    return this.ciudadesService.crear(body);
  }

  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCiudadDto,
  ) {
    return this.ciudadesService.actualizar(id, body);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.ciudadesService.eliminar(id);
  }
}
