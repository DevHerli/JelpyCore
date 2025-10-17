import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { KeywordTaxonomia } from '../../catalogos/taxonomia/entities/keyword-taxonomia.entity';
import { VistaNegociosCompleta } from '../vista-completa/entities/vista-negocios.view';

@Module({
  imports: [TypeOrmModule.forFeature([KeywordTaxonomia, VistaNegociosCompleta])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
