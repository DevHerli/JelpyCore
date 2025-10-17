import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VistaNegociosCompleta } from './entities/vista-negocios.view';

@Module({
  imports: [TypeOrmModule.forFeature([VistaNegociosCompleta])],
  exports: [TypeOrmModule],
})
export class VistaCompletaModule {}
