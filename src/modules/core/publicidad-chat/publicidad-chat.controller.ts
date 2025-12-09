import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Delete,
  } from '@nestjs/common';
  import { PublicidadChatService } from './publicidad-chat.service';
  import { CreatePublicidadChatDto } from './dtos/create-publicidad-chat.dto';
  
  @Controller('publicidad-chat')
  export class PublicidadChatController {
    constructor(
      private readonly publicidadService: PublicidadChatService,
    ) {}
  
    @Post()
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
    async delete(@Param('id', ParseIntPipe) id: number) {
      return this.publicidadService.delete(id);
    }
  }
  