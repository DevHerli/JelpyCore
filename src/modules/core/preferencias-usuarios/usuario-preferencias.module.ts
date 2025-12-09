import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioPreferencia } from './entities/usuario-preferencias.entity';
import { UsuarioPreferenciasService } from './usuario-preferencias.service';

@Module({
  imports: [TypeOrmModule.forFeature([UsuarioPreferencia])],
  providers: [UsuarioPreferenciasService],
  exports: [UsuarioPreferenciasService],
})
export class UsuarioPreferenciasModule {}
