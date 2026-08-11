import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Delete,
    UseGuards,
  } from '@nestjs/common';
  import { AdminGuard } from '../../../common/guards/admin.guard';
  import { PublicidadChatService } from './publicidad-chat.service';
  import { CreatePublicidadChatDto } from './dtos/create-publicidad-chat.dto';

  // JLP-H18 — Catálogo maestro: escritura restringida a administradores.
  @Controller('publicidad-chat')
  export class PublicidadChatController {
    constructor(
      private readonly publicidadService: PublicidadChatService,
    ) {}

    @Post()
    @UseGuards(AdminGuard)
    async crear(@Body() dto: CreatePublicidadChatDto) {
      return this.publicidadService.crear(dto);
    }
  
    @Get()
    async findAll() {
      return this.publicidadService.findAll();
    }
  
    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number) {
      return this.publicidadService.findOne(id);
    }
  
    @Delete(':id')
    @UseGuards(AdminGuard)
    async delete(@Param('id', ParseIntPipe) id: number) {
      return this.publicidadService.delete(id);
    }
  }
  