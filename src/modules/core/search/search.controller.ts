import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchDto } from './dto/search.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get()
  async search(@Query() dto: SearchDto) {
    if (!dto.q) throw new BadRequestException('Falta parámetro q');

    const resp = await this.svc.search({
      q: dto.q,
      ciudad: dto.ciudad,

      // Igual que tenías
      abiertoAhora: dto.abiertoAhora === 'true',
      lat: dto.lat ? Number(dto.lat) : undefined,
      lng: dto.lng ? Number(dto.lng) : undefined,
      radioKm: dto.radioKm ? Number(dto.radioKm) : undefined,

      // Nuevos campos del DTO (solo agregados, no se cambió nada)
      categoriaId: dto.categoriaId ? Number(dto.categoriaId) : undefined,
      subcategoriaId: dto.subcategoriaId ? Number(dto.subcategoriaId) : undefined,
      especialidadId: dto.especialidadId ? Number(dto.especialidadId) : undefined,
      promos: dto.promos === 'true',
    });

    return resp;
  }
}
