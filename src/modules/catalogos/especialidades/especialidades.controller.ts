import { Body, Controller, Get, Param, Post, Put, Delete } from '@nestjs/common';
import { EspecialidadesService } from './especialidades.service';
import { CreateEspecialidadDto } from './dto/create-especialidad.dto';
import { UpdateEspecialidadDto } from './dto/update-especialidad.dto';

@Controller('especialidades')
export class EspecialidadesController {
  constructor(private readonly especialidadesService: EspecialidadesService) {}

  // 🔹 Listar todas las especialidades activas
  @Get()
  listar() {
    return this.especialidadesService.listar();
  }

  // 🔹 Obtener una especialidad específica por ID
  @Get(':id')
  obtener(@Param('id') id: number) {
    return this.especialidadesService.obtenerPorId(id);
  }

  // 🔹 Crear una nueva especialidad
  @Post()
  async crearEspecialidad(@Body() dto: CreateEspecialidadDto) {
    return this.especialidadesService.crear(dto);
  }

  // 🔹 Actualizar una especialidad existente
  @Put(':id')
  async actualizarEspecialidad(
    @Param('id') id: number,
    @Body() dto: UpdateEspecialidadDto,
  ) {
    return this.especialidadesService.actualizar(id, dto);
  }

  // 🔹 Borrado lógico (marcar como inactiva)
  @Delete(':id')
  async eliminarEspecialidad(@Param('id') id: number) {
    return this.especialidadesService.eliminar(id);
  }
}
