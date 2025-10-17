import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KeywordTaxonomia } from './entities/keyword-taxonomia.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KeywordTaxonomia])],
  exports: [TypeOrmModule],
})
export class TaxonomiaModule {}
