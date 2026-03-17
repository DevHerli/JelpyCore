import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PostalCodesService } from './postal-codes.service';
import { PostalCodesController } from './postal-codes.controller';
import { PostalCode } from './entities/postal-code.entity';
import { Ciudad } from '../../catalogos/ciudades/entities/ciudades.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PostalCode, Ciudad])],
  controllers: [PostalCodesController],
  providers: [PostalCodesService],
  exports: [PostalCodesService, TypeOrmModule],
})
export class PostalCodesModule {}