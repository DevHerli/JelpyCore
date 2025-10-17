import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JerarquiaController } from './jerarquia.controller';
import { JerarquiaService } from './jerarquia.service';
import { Categoria } from '../categorias/entities/categorias.entity';
import { Subcategoria } from '../subcategorias/entities/subcategorias.entity';
import { Especialidad } from '../especialidades/entities/especialidades.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Categoria, Subcategoria, Especialidad])],
  controllers: [JerarquiaController],
  providers: [JerarquiaService],
})
export class JerarquiaModule {}
