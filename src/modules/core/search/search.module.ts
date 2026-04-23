import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { KeywordTaxonomia } from '../taxonomia/entities/keyword-taxonomia.entity';
import { VistaNegociosCompleta } from '../vista-completa/entities/vista-negocios.view';
import { ItemNegocio } from '../../business/catalogo_productos/entities/item-negocio.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KeywordTaxonomia, VistaNegociosCompleta, ItemNegocio])],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
