import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JelpyAssistantController } from './jelpy-assistant.controller';
import { JelpyAssistantService } from './jelpy-assistant.service';

import { FiltrosBusquedaModule } from '../../filtros_busqueda/filtros_busqueda.module';
import { SearchModule } from '../../search/search.module';
import { AiModule } from '../ai.module';
import { UsuarioPreferenciasModule } from '../../preferencias-usuarios/usuario-preferencias.module';
import { JelpyAiModule } from '../../../jelpy-ai/jelpy-ai.module';

import { Ciudad } from '../../../catalogos/ciudades/entities/ciudades.entity';
import { Categoria } from '../../../catalogos/categorias/entities/categorias.entity';
import { Subcategoria } from '../../../catalogos/subcategorias/entities/subcategorias.entity';
import { Especialidad } from '../../../catalogos/especialidades/entities/especialidades.entity';
import { KeywordTaxonomia } from '../../taxonomia/entities/keyword-taxonomia.entity';
import { ItemNegocio } from '../../../business/catalogo_productos/entities/item-negocio.entity';

import { CaracteristicaSucursal } from '../../../business/caracteristicas_sucursales/entities/caracteristica-sucursal.entity';
import { CaracteristicaAlias } from '../../../business/caracteristicas_sucursales/entities/caracteristica-alias.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ciudad,
      Categoria,
      Subcategoria,
      Especialidad,
      KeywordTaxonomia,
      ItemNegocio,
      CaracteristicaSucursal,
      CaracteristicaAlias,
    ]),

    forwardRef(() => SearchModule),
    forwardRef(() => UsuarioPreferenciasModule),
    forwardRef(() => FiltrosBusquedaModule),
    forwardRef(() => AiModule),
    forwardRef(() => JelpyAiModule),
  ],
  controllers: [JelpyAssistantController],
  providers: [JelpyAssistantService],
  exports: [JelpyAssistantService],
})
export class JelpyAssistantModule {}