import { Controller, Get } from '@nestjs/common';
import { JerarquiaService } from './jerarquia.service';

@Controller('catalogos/jerarquia')
export class JerarquiaController {
  constructor(private readonly jerarquiaService: JerarquiaService) {}

  @Get()
  async obtenerJerarquia() {
    return this.jerarquiaService.obtenerJerarquia();
  }
}
