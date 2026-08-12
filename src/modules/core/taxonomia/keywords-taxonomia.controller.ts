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
    UseGuards,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
  import { AdminGuard } from '../../../common/guards/admin.guard';
  import { KeywordsTaxonomiaService } from './keywords-taxonomia.service';
  import { CreateKeywordDto } from './dtos/create-keyword.dto';
  import { UpdateKeywordDto } from './dtos/update-keyword.dto';
  import { KeywordTaxonomia } from './entities/keyword-taxonomia.entity';

  // JLP-H18 — Catálogo maestro: escritura restringida a administradores.
  @ApiTags('Keywords Taxonomía')
  @Controller('keywords-taxonomia')
  export class KeywordsTaxonomiaController {
    constructor(
      private readonly keywordsService: KeywordsTaxonomiaService,
    ) {}
  
    @Post()
    @UseGuards(AdminGuard)
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
  
    /**
     * JLP-B15 — Bug de orden de rutas: GET /:id estaba declarado ANTES que
     * GET /buscar, por lo que NestJS capturaba /buscar como id='buscar' y
     * ParseIntPipe lanzaba 400 antes de llegar al handler correcto.
     * Fix: /buscar siempre debe ir ANTES de /:id.
     */
    @Get('buscar')
    @ApiOperation({ summary: 'Buscar por tipo y referencia' })
    findByReferencia(
      @Query('tipo') tipo: 'categoria' | 'subcategoria' | 'especialidad',
      @Query('referenciaId', ParseIntPipe) referenciaId: number,
    ) {
      return this.keywordsService.findByReferencia(tipo, referenciaId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener keyword por ID' })
    findOne(@Param('id', ParseIntPipe) id: number) {
      return this.keywordsService.findOne(id);
    }
  
    @Patch(':id')
    @UseGuards(AdminGuard)
    @ApiOperation({ summary: 'Actualizar keyword' })
    update(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: UpdateKeywordDto,
    ) {
      return this.keywordsService.update(id, dto);
    }
  
    @Delete(':id')
    @UseGuards(AdminGuard)
    @ApiOperation({ summary: 'Eliminar keyword' })
    remove(@Param('id', ParseIntPipe) id: number) {
      return this.keywordsService.remove(id);
    }
  }
  