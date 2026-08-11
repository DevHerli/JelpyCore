import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  UploadedFile,
  UseInterceptors,
  Query,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CatalogoProductosService, RequesterCtx } from './catalogo-productos.service';
import { CreateCategoriaDto, CreateItemNegocioDto, UpdateItemSucursalDto } from './dtos/create-update-catalogo.dto';
import { v2 as cloudinary } from 'cloudinary';

// JLP-H19 — Escritura del catálogo restringida al dueño del negocio (o admin).
@Controller('catalogo-productos')
export class CatalogoProductosController {
  constructor(private readonly catalogoService: CatalogoProductosService) {}

  private requester(req: any): RequesterCtx {
    return { sub: Number(req.user?.sub), isAdmin: req.user?.role === 'admin' };
  }

  // ================= CATEGORÍAS =================
  @Post('categorias')
  @UseGuards(JwtAuthGuard)
  crearCategoria(@Body() dto: CreateCategoriaDto, @Req() req: any) {
    return this.catalogoService.crearCategoria(dto, this.requester(req));
  }

  @Get('categorias/:negocioId')
  getCategorias(@Param('negocioId') negocioId: number) {
    return this.catalogoService.getCategorias(negocioId);
  }

  // ================= ITEMS (PRODUCTOS/SERVICIOS) =================
  @Post('items')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async crearItem(
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const requester = this.requester(req);
    const negocioId = Number(body.negocioId);

    // Validar propiedad ANTES de subir a Cloudinary (evita cargas no autorizadas).
    await this.catalogoService.assertPuedeGestionarNegocio(negocioId, requester);

    let imagenUrl = null;

    // Subida a Cloudinary
    if (file) {
      try {
        const upload: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'jelpy/catalogo' },
            (error, result) => (error ? reject(error) : resolve(result))
          );
          stream.end(file.buffer);
        });
        imagenUrl = upload.secure_url;
      } catch (e) { console.error(e); }
    }

    // Convertir datos (FormData llega como string)
    const dto: CreateItemNegocioDto = {
      negocioId: Number(body.negocioId),
      categoriaId: body.categoriaId ? Number(body.categoriaId) : undefined,
      nombre: body.nombre,
      descripcion: body.descripcion,
      precioBase: Number(body.precioBase),
      tipo: body.tipo,
      duracionMinutos: body.duracionMinutos ? Number(body.duracionMinutos) : undefined
    };

    return this.catalogoService.crearItem({ ...dto, imagenUrl }, requester);
  }

  @Get('items/:negocioId')
  getItemsNegocio(@Param('negocioId') negocioId: number) {
    return this.catalogoService.getItemsNegocio(negocioId);
  }

  @Put('items/:id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  async editarItem(
    @Param('id') id: number,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const requester = this.requester(req);

    // Validar propiedad ANTES de subir a Cloudinary (evita cargas no autorizadas).
    await this.catalogoService.assertPuedeGestionarItem(id, requester);

    let imagenUrl = undefined; // Undefined para que el servicio sepa si no se cambió

    if (file) {
      // Misma lógica de subida a Cloudinary
      try {
        const upload: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'jelpy/catalogo' },
            (error, result) => (error ? reject(error) : resolve(result))
          );
          stream.end(file.buffer);
        });
        imagenUrl = upload.secure_url;
      } catch (e) { console.error(e); }
    }

    // Convertimos los datos
    const updateData = {
      nombre: body.nombre,
      descripcion: body.descripcion,
      precioBase: body.precioBase ? Number(body.precioBase) : undefined,
      tipo: body.tipo,
      duracionMinutos: body.duracionMinutos ? Number(body.duracionMinutos) : undefined,
      ...(imagenUrl && { imagenUrl }) // Solo agregamos imagen si se subió nueva
    };

    return this.catalogoService.actualizarItem(id, updateData, requester);
  }

  // ================= DISPONIBILIDAD (SUCURSAL) =================
  @Put('disponibilidad')
  @UseGuards(JwtAuthGuard)
  setDisponibilidad(@Body() dto: UpdateItemSucursalDto, @Req() req: any) {
    return this.catalogoService.setDisponibilidad(dto, this.requester(req));
  }

  // ================= MENÚ PÚBLICO (FINAL) =================
  // Ejemplo de uso: GET /catalogo/publico/11?negocioId=9
  @Get('publico/:sucursalId')
  getMenuPublico(
    @Param('sucursalId') sucursalId: number, 
    @Query('negocioId') negocioId: number // <--- CORREGIDO
  ) {
    return this.catalogoService.getMenuParaSucursal(sucursalId, negocioId);
  }

  // ELIMINAR ITEM
  @Delete('items/:id')
  @UseGuards(JwtAuthGuard)
  eliminarItem(@Param('id') id: number, @Req() req: any) {
    return this.catalogoService.eliminarItem(id, this.requester(req));
  }
  
}