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
      abiertoAhora: dto.abiertoAhora === 'true',
      lat: dto.lat ? Number(dto.lat) : undefined,
      lng: dto.lng ? Number(dto.lng) : undefined,
      radioKm: dto.radioKm ? Number(dto.radioKm) : undefined,
    });
    return resp;
  }
}
