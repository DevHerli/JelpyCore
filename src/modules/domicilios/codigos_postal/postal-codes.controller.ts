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
import { PostalCodesService } from './postal-codes.service';
import { CreatePostalCodeDto } from './dtos/create-postal-code.dto';
import { UpdatePostalCodeDto } from './dtos/update-postal-code.dto';

@Controller('postal-codes')
export class PostalCodesController {
  constructor(private readonly postalCodesService: PostalCodesService) {}

  @Post()
  create(@Body() createPostalCodeDto: CreatePostalCodeDto) {
    return this.postalCodesService.create(createPostalCodeDto);
  }

  @Get()
  findAll(
    @Query('ciudad_id') ciudad_id?: string,
    @Query('codigo_postal') codigo_postal?: string,
    @Query('activo') activo?: string,
  ) {
    return this.postalCodesService.findAll({
      ciudad_id,
      codigo_postal,
      activo,
    });
  }

  @Get('city/:ciudadId')
  findByCity(@Param('ciudadId') ciudadId: string) {
    return this.postalCodesService.findByCity(ciudadId);
  }

  @Get('search/by-code/:codigoPostal')
  findByPostalCode(@Param('codigoPostal') codigoPostal: string) {
    return this.postalCodesService.findByPostalCode(codigoPostal);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postalCodesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePostalCodeDto: UpdatePostalCodeDto,
  ) {
    return this.postalCodesService.update(id, updatePostalCodeDto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('eliminado_por') eliminado_por?: string,
  ) {
    return this.postalCodesService.remove(id, eliminado_por);
  }
}