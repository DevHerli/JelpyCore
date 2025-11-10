import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KeywordTaxonomia } from './entities/keyword-taxonomia.entity';
import { KeywordsTaxonomiaService } from './keywords-taxonomia.service';
import { KeywordsTaxonomiaController } from './keywords-taxonomia.controller';

@Module({
  imports: [TypeOrmModule.forFeature([KeywordTaxonomia])],
  controllers: [KeywordsTaxonomiaController],
  providers: [KeywordsTaxonomiaService],
  exports: [KeywordsTaxonomiaService, TypeOrmModule],
})
export class TaxonomiaModule {}
