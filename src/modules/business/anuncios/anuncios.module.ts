import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AnunciosController } from './anuncios.controller';
import { AnunciosService } from './anuncios.service';

import { Anuncio } from './entities/anuncio.entity';
import { AnuncioEvento } from './entities/anuncio-evento.entity';
import { AnuncioCupoMensual } from './entities/anuncio-cupo-mensual.entity';
import { AnuncioAddon } from './entities/anuncio-addon.entity';

import { Negocio } from '../negocios/entities/negocio.entity';
import { Suscriptor } from '../suscriptores/entities/suscriptores.entity';
import { Membresia } from '../membresias/entities/membresia.entity';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Anuncio,
      AnuncioEvento,
      AnuncioCupoMensual,
      AnuncioAddon,
      Negocio,
      Suscriptor,
      Membresia,
      SucursalNegocio,
    ]),
  ],
  controllers: [AnunciosController],
  providers: [AnunciosService],
  exports: [AnunciosService],
})
export class AnunciosModule {}
