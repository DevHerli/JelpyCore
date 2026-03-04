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
  Delete
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CatalogoProductosService } from './catalogo-productos.service';
import { CreateCategoriaDto, CreateItemNegocioDto, UpdateItemSucursalDto } from './dtos/create-update-catalogo.dto';
import { v2 as cloudinary } from 'cloudinary';

@Controller('catalogo-productos')
export class CatalogoProductosController {
  constructor(private readonly catalogoService: CatalogoProductosService) {}

  // ================= CATEGORÍAS =================
  @Post('categorias')
  crearCategoria(@Body() dto: CreateCategoriaDto) {
    return this.catalogoService.crearCategoria(dto);
  }

  @Get('categorias/:negocioId')
  getCategorias(@Param('negocioId') negocioId: number) {
    return this.catalogoService.getCategorias(negocioId);
  }

  // ================= ITEMS (PRODUCTOS/SERVICIOS) =================
  @Post('items')
  @UseInterceptors(FileInterceptor('imagen'))
  async crearItem(@Body() body: any, @UploadedFile() file: Express.Multer.File) {
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

    return this.catalogoService.crearItem({ ...dto, imagenUrl });
  }

  @Get('items/:negocioId')
  getItemsNegocio(@Param('negocioId') negocioId: number) {
    return this.catalogoService.getItemsNegocio(negocioId);
  }

  @Put('items/:id')
  @UseInterceptors(FileInterceptor('imagen'))
  async editarItem(
    @Param('id') id: number,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File
  ) {
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

    return this.catalogoService.actualizarItem(id, updateData);
  }

  // ================= DISPONIBILIDAD (SUCURSAL) =================
  @Put('disponibilidad')
  setDisponibilidad(@Body() dto: UpdateItemSucursalDto) {
    return this.catalogoService.setDisponibilidad(dto);
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
  eliminarItem(@Param('id') id: number) {
    return this.catalogoService.eliminarItem(id);
  }
  
}