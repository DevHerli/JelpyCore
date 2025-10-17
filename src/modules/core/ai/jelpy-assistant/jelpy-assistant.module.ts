import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JelpyAssistantController } from './jelpy-assistant.controller';
import { JelpyAssistantService } from './jelpy-assistant.service';
import { FiltrosBusquedaModule } from '../../filtros_busqueda/filtros_busqueda.module';
import { Ciudad } from '../../../catalogos/ciudades/entities/ciudades.entity';
import { Categoria } from '../../../catalogos/categorias/entities/categorias.entity';
import { Subcategoria } from '../../../catalogos/subcategorias/entities/subcategorias.entity';
import { AiModule } from '../ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ciudad, Categoria, Subcategoria]),
    forwardRef(() => FiltrosBusquedaModule),
    forwardRef(() => AiModule),
  ],
  controllers: [JelpyAssistantController],
  providers: [JelpyAssistantService],
  exports: [JelpyAssistantService],
})
export class JelpyAssistantModule {}
