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
    // Permitir q o termino
    const query = dto.q ?? dto.termino;

    if (!query) {
      throw new BadRequestException('Falta parámetro q o termino');
    }

    const resp = await this.svc.search({
      q: query,
      ciudad: dto.ciudad,

      abiertoAhora: dto.abiertoAhora === 'true',
      lat: dto.lat ? Number(dto.lat) : undefined,
      lng: dto.lng ? Number(dto.lng) : undefined,
      radioKm: dto.radioKm ? Number(dto.radioKm) : undefined,

      categoriaId: dto.categoriaId ? Number(dto.categoriaId) : undefined,
      subcategoriaId: dto.subcategoriaId ? Number(dto.subcategoriaId) : undefined,
      especialidadId: dto.especialidadId ? Number(dto.especialidadId) : undefined,

      promos: dto.promos === 'true',
    });

    return resp;
  }
}
