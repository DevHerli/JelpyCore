import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    ParseIntPipe,
    Query,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
  import { KeywordsTaxonomiaService } from './keywords-taxonomia.service';
  import { CreateKeywordDto } from './dtos/create-keyword.dto';
  import { UpdateKeywordDto } from './dtos/update-keyword.dto';
  import { KeywordTaxonomia } from './entities/keyword-taxonomia.entity';
  
  @ApiTags('Keywords Taxonomía')
  @Controller('keywords-taxonomia')
  export class KeywordsTaxonomiaController {
    constructor(
      private readonly keywordsService: KeywordsTaxonomiaService,
    ) {}
  
    @Post()
    @ApiOperation({ summary: 'Crear nueva keyword' })
    @ApiResponse({ status: 201, type: KeywordTaxonomia })
    create(@Body() dto: CreateKeywordDto) {
      return this.keywordsService.create(dto);
    }
  
    @Get()
    @ApiOperation({ summary: 'Listar todas las keywords' })
    @ApiResponse({ status: 200, type: [KeywordTaxonomia] })
    findAll() {
      return this.keywordsService.findAll();
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Obtener keyword por ID' })
    findOne(@Param('id', ParseIntPipe) id: number) {
      return this.keywordsService.findOne(id);
    }
  
    @Get('buscar')
    @ApiOperation({ summary: 'Buscar por tipo y referencia' })
    findByReferencia(
      @Query('tipo') tipo: 'categoria' | 'subcategoria' | 'especialidad',
      @Query('referenciaId', ParseIntPipe) referenciaId: number,
    ) {
      return this.keywordsService.findByReferencia(tipo, referenciaId);
    }
  
    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar keyword' })
    update(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: UpdateKeywordDto,
    ) {
      return this.keywordsService.update(id, dto);
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar keyword' })
    remove(@Param('id', ParseIntPipe) id: number) {
      return this.keywordsService.remove(id);
    }
  }
  