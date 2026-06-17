import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { PublicSucursalesService } from './public-sucursales.service';

/**
 * Endpoints públicos (sin autenticación) para listado de sucursales.
 * Base: /public/sucursales
 */
@Controller('public/sucursales')
export class PublicSucursalesController {
  constructor(private readonly service: PublicSucursalesService) {}

  /**
   * GET /public/sucursales
   * Listado paginado con filtros opcionales de categoría, subcategoría y ciudad.
   */
  @Get()
  listar(
    @Query('categoriaId')   categoriaId?: string,
    @Query('subcategoriaId') subcategoriaId?: string,
    @Query('ciudadId')      ciudadId?: string,
    @Query('page',    new DefaultValuePipe(1),  ParseIntPipe) page:  number = 1,
    @Query('limit',   new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    return this.service.listar({
      categoriaId:    categoriaId   ? Number(categoriaId)   : undefined,
      subcategoriaId: subcategoriaId ? Number(subcategoriaId) : undefined,
      ciudadId:       ciudadId      ? Number(ciudadId)      : undefined,
      page:  Math.max(1, page),
      limit: Math.min(50, Math.max(1, limit)),
    });
  }

  /**
   * GET /public/sucursales/destacados?ciudadId=3&limit=10
   * Sucursales de negocios con membresía activa (premium/delux).
   */
  @Get('destacados')
  destacados(
    @Query('ciudadId') ciudadId?: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.service.destacados({
      ciudadId: ciudadId ? Number(ciudadId) : undefined,
      limit: Math.min(50, Math.max(1, limit)),
    });
  }

  /**
   * GET /public/sucursales/sugeridos?ciudadId=3&limit=10
   * Sucursales con promoción activa; si no hay suficientes, completa con las más recientes.
   */
  @Get('sugeridos')
  sugeridos(
    @Query('ciudadId') ciudadId?: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.service.sugeridos({
      ciudadId: ciudadId ? Number(ciudadId) : undefined,
      limit: Math.min(50, Math.max(1, limit)),
    });
  }

  /**
   * GET /public/sucursales/mas-likes?ciudadId=3&limit=10
   * Las sucursales con más "me gusta" acumulados.
   */
  @Get('mas-likes')
  masLikes(
    @Query('ciudadId') ciudadId?: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.service.masLikes({
      ciudadId: ciudadId ? Number(ciudadId) : undefined,
      limit: Math.min(50, Math.max(1, limit)),
    });
  }

  /**
   * GET /public/sucursales/mas-buscados?ciudadId=3&limit=10&dias=30
   * Las sucursales más buscadas según métricas históricas.
   * - dias: ventana de tiempo a considerar (default 30, max 90)
   */
  @Get('mas-buscados')
  masBuscados(
    @Query('ciudadId') ciudadId?: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Query('dias',  new DefaultValuePipe(30), ParseIntPipe) dias:  number = 30,
  ) {
    return this.service.masBuscados({
      ciudadId: ciudadId ? Number(ciudadId) : undefined,
      limit: Math.min(50, Math.max(1, limit)),
      dias:  Math.min(90, Math.max(1, dias)),
    });
  }
}
