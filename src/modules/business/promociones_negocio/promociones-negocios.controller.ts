import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Express } from 'express';

import { CloudinaryService } from '../../../common/cloudinary/cloudinary.service';
import { PromocionesNegociosService } from './promociones-negocios.service';
import { CreatePromotionBusinessDto } from './dtos/create-promotion-business.dto';
import { UpdatePromotionBusinessDto } from './dtos/update-promotion-business.dto';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

@Controller('promociones-negocios')
export class PromocionesNegociosController {
  constructor(
    private readonly service: PromocionesNegociosService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreatePromotionBusinessDto,
  ) {
    if (file) {
      this.validateImageFile(file);
      const upload = await this.cloudinary.uploadBuffer(file.buffer, {
        folder: 'jelpy/promociones',
        resource_type: 'image',
      });
      dto.imagenUrl = upload.secure_url;
    } else {
      dto.imagenUrl = dto.imagenUrl ?? null;
    }

    return this.service.create(dto);
  }

  @Get('negocio/:businessId')
  findByBusiness(@Param('businessId', ParseIntPipe) businessId: number) {
    return this.service.findByBusiness(businessId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdatePromotionBusinessDto,
  ) {
    if (file) {
      this.validateImageFile(file);

      const actual = await this.service.findOne(id);
      if (actual?.imagenUrl) {
        await this.cloudinary.destroy(actual.imagenUrl);
      }

      const upload = await this.cloudinary.uploadBuffer(file.buffer, {
        folder: 'jelpy/promociones',
        resource_type: 'image',
      });
      dto.imagenUrl = upload.secure_url;
    }

    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private validateImageFile(file: Express.Multer.File) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Formato de imagen no permitido. Usa JPG, PNG o WEBP.');
    }
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('La imagen excede 5 MB.');
    }
  }
}
