import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubcategoriasController } from './subcategorias.controller';
import { SubcategoriasService } from './subcategorias.service';
import { Subcategoria } from './entities/subcategorias.entity';
import { Categoria } from '../categorias/entities/categorias.entity';
import { Especialidad } from '../especialidades/entities/especialidades.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subcategoria, Categoria, Especialidad])],
  controllers: [SubcategoriasController],
  providers: [SubcategoriasService],
  exports: [SubcategoriasService],
})
export class SubcategoriasModule {}
