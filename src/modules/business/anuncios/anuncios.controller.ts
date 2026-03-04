import {
    BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ParseFilePipe,
  FileTypeValidator,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { AnunciosService } from './anuncios.service';
import { CreateAnuncioDto } from './dtos/create-anuncio.dto';
import { UpdateAnuncioStatusDto } from './dtos/update-anuncio-status.dto';
import { TrackAnuncioEventDto } from './dtos/track-anuncio-event.dto';
import { UpdateAnuncioDto } from './dtos/update-anuncio.dto';

@Controller('ads')
export class AnunciosController {
  constructor(private readonly anunciosService: AnunciosService) {}

  @Get('dashboard/:negocioId')
  dashboard(@Param('negocioId', ParseIntPipe) negocioId: number) {
    return this.anunciosService.getDashboard(negocioId);
  }

@Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.anunciosService.findOne(id);
  }

  @Post('upload/:negocioId')
@UseInterceptors(FileInterceptor('imagen'))
async uploadImagenAnuncio(
  @Param('negocioId', ParseIntPipe) negocioId: number,
  @UploadedFile(
    new ParseFilePipe({
      validators: [
        new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
        new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }), // 5MB
      ],
    }),
  )
  file: Express.Multer.File,
) {
  // Subir a Cloudinary
  const upload = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `jelpy/anuncios/${negocioId}` },
      (error, result) => {
        if (error) reject(error);
        else resolve(result as UploadApiResponse);
      },
    );
    stream.end(file.buffer);
  });

  return {
    url: upload.secure_url,
    publicId: upload.public_id,
  };
}

  @Post()
  create(@Body() dto: CreateAnuncioDto) {
    return this.anunciosService.create(dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnuncioStatusDto,
  ) {
    return this.anunciosService.updateStatus(id, dto);
  }

  @Post(':id/track')
  track(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TrackAnuncioEventDto,
  ) {
    return this.anunciosService.trackEvent(id, dto);
  }

  @Delete('upload')
async deleteCloudinary(@Body() body: { publicId: string }) {
  if (!body?.publicId) throw new BadRequestException('publicId requerido');
  await cloudinary.uploader.destroy(body.publicId);
  return { success: true };
}

@Patch(':id/image')
updateImage(
  @Param('id', ParseIntPipe) id: number,
  @Body() body: { imagenUrl: string; publicId?: string },
) {
  return this.anunciosService.updateAdImage(id, body.imagenUrl, body.publicId);
}

@Put(':id')
update(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: UpdateAnuncioDto,
) {
  return this.anunciosService.update(id, dto);
}


}
