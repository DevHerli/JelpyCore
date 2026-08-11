import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ParseFilePipe,
  FileTypeValidator,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AnunciosService, RequesterCtx } from './anuncios.service';
import { CreateAnuncioDto } from './dtos/create-anuncio.dto';
import { UpdateAnuncioStatusDto } from './dtos/update-anuncio-status.dto';
import { TrackAnuncioEventDto } from './dtos/track-anuncio-event.dto';
import { UpdateAnuncioDto } from './dtos/update-anuncio.dto';

/**
 * JLP-C13 — Mutaciones protegidas con JwtAuthGuard + propiedad del negocio
 * (verificada en el servicio vía negocio.suscriptor). El feed público, el
 * tracking y findOne se mantienen públicos.
 */
@Controller('ads')
export class AnunciosController {
  constructor(private readonly anunciosService: AnunciosService) {}

  private requester(req: any): RequesterCtx {
    return { sub: Number(req.user?.sub), isAdmin: req.user?.role === 'admin' };
  }

  // -----------------------------------------------------------------------
  // RUTAS ESTÁTICAS — deben ir ANTES de :id para que no sean interceptadas
  // -----------------------------------------------------------------------

  /** Feed público consumido por el home */
  @Get('public')
  getPublicAds(
    @Query('placement') placement: string,
    @Query('ciudadId') ciudadId?: string,
    @Query('categoria') categoria?: string,
    @Query('limit') limit?: string,
  ) {
    if (!placement) throw new BadRequestException('placement es requerido');
    return this.anunciosService.getPublicAds({
      placement,
      ciudadId: ciudadId ? Number(ciudadId) : undefined,
      categoria,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /** Placements permitidos según el tier del negocio */
  @Get('placements-permitidos/:negocioId')
  getPlacementsPermitidos(@Param('negocioId', ParseIntPipe) negocioId: number) {
    return this.anunciosService.getPlacementsPermitidos(negocioId);
  }

  /** Dashboard del negocio */
  @Get('dashboard/:negocioId')
  @UseGuards(JwtAuthGuard)
  dashboard(
    @Param('negocioId', ParseIntPipe) negocioId: number,
    @Request() req: any,
  ) {
    return this.anunciosService.getDashboard(negocioId, this.requester(req));
  }

  // -----------------------------------------------------------------------
  // TRACKING
  // -----------------------------------------------------------------------

  /**
   * JLP-M13 — El tracking es intencionalmente público (se activa desde el feed
   * sin requerir sesión) pero se limita a 20 req/min por IP para impedir
   * inflado artificial de métricas de manera coordinada.
   */
  @Throttle({ default: { limit: 20, ttl: 60 } })
  @Post(':id/impression')
  impression(@Param('id', ParseIntPipe) id: number) {
    return this.anunciosService.impression(id);
  }

  @Throttle({ default: { limit: 20, ttl: 60 } })
  @Post(':id/click')
  click(@Param('id', ParseIntPipe) id: number) {
    return this.anunciosService.click(id);
  }

  // -----------------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------------

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.anunciosService.findOne(id);
  }

  @Post('upload/:negocioId')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async uploadImagenAnuncio(
    @Param('negocioId', ParseIntPipe) negocioId: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Request() req: any,
  ) {
    // JLP-C13 — Verifica propiedad del negocio ANTES de subir a Cloudinary
    // (evita gasto de almacenamiento por atacantes autenticados).
    await this.anunciosService.assertPuedeGestionarNegocio(
      negocioId,
      this.requester(req),
    );

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

    return { url: upload.secure_url, publicId: upload.public_id };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateAnuncioDto, @Request() req: any) {
    return this.anunciosService.create(dto, this.requester(req));
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnuncioStatusDto,
    @Request() req: any,
  ) {
    return this.anunciosService.updateStatus(id, dto, this.requester(req));
  }

  @Throttle({ default: { limit: 30, ttl: 60 } })
  @Post(':id/track')
  track(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TrackAnuncioEventDto,
  ) {
    return this.anunciosService.trackEvent(id, dto);
  }

  @Delete('upload')
  @UseGuards(JwtAuthGuard)
  async deleteCloudinary(
    @Body() body: { publicId: string },
    @Request() req: any,
  ) {
    if (!body?.publicId) throw new BadRequestException('publicId requerido');

    // JLP-C13 — El publicId arbitrario permitía borrar CUALQUIER asset de
    // Cloudinary. Los anuncios se suben a `jelpy/anuncios/{negocioId}/...`;
    // sólo permitimos destruir assets dentro de un negocio que el solicitante
    // posea (o admin). Cualquier otro path se rechaza.
    const requester = this.requester(req);
    const match = /^jelpy\/anuncios\/(\d+)\//.exec(body.publicId);
    if (!match) {
      throw new ForbiddenException('publicId fuera del ámbito de anuncios.');
    }
    const negocioId = Number(match[1]);
    await this.anunciosService.assertPuedeGestionarNegocio(negocioId, requester);

    await cloudinary.uploader.destroy(body.publicId);
    return { success: true };
  }

  @Patch(':id/image')
  @UseGuards(JwtAuthGuard)
  updateImage(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { imagenUrl: string; publicId?: string },
    @Request() req: any,
  ) {
    return this.anunciosService.updateAdImage(
      id,
      body.imagenUrl,
      body.publicId,
      this.requester(req),
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnuncioDto,
    @Request() req: any,
  ) {
    return this.anunciosService.update(id, dto, this.requester(req));
  }
}
