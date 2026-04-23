import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ColoniasService } from './colonias.service';
import { ColoniasController } from './colonias.controller';
import { Colonia } from './entities/colonia.entity';
import { PostalCode } from '../codigos_postal/entities/postal-code.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Colonia, PostalCode])],
  controllers: [ColoniasController],
  providers: [ColoniasService],
  exports: [ColoniasService, TypeOrmModule],
})
export class ColoniasModule {}