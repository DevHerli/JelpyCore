import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StreetsService } from './streets.service';
import { StreetsController } from './streets.controller';
import { Street } from './entities/street.entity';
import { StreetColony } from './entities/street-colony.entity';
import { Colonia } from '../colonias/entities/colonia.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Street, StreetColony, Colonia])],
  controllers: [StreetsController],
  providers: [StreetsService],
  exports: [StreetsService, TypeOrmModule],
})
export class StreetsModule {}