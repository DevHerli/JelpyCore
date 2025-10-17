import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { ReportesModeracionService } from './reportes-moderacion.service';

@Controller('reportes-moderacion')
export class ReportesModeracionController {
  constructor(private readonly service: ReportesModeracionService) {}

  @Get()
  listar() {
    return this.service.listar();
  }

//   @Get(':id')
//   obtener(@Param('id') id: number) {
//     return this.service.obtenerPorId(id);
//   }

//   @Patch(':id/atendido')
//   marcarAtendido(@Param('id') id: number, @Body('observaciones') obs: string) {
//     return this.service.marcarComoAtendido(id, obs);
//   }


}
