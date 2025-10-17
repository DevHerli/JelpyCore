import { Injectable } from '@nestjs/common';
import { FiltrosBusquedaService } from '../../filtros_busqueda/filtros_busqueda.service';
import { FiltrosBusquedaDto } from '../../filtros_busqueda/dto/filtros-busqueda.dto';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Ciudad } from '../../../catalogos/ciudades/entities/ciudades.entity';
import { Categoria } from '../../../catalogos/categorias/entities/categorias.entity';
import { Subcategoria } from '../../../catalogos/subcategorias/entities/subcategorias.entity';

@Injectable()
export class JelpyAssistantService {
  constructor(
    private readonly filtrobusquedaService: FiltrosBusquedaService,

    @InjectRepository(Ciudad)
    private readonly ciudadRepo: Repository<Ciudad>,

    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,

    @InjectRepository(Subcategoria)
    private readonly subcatRepo: Repository<Subcategoria>,
  ) {}

  /**
   * Interpreta texto natural y lo transforma en filtros de búsqueda
   */
  async interpretar(texto: string, latitud?: number, longitud?: number) {
    const filtros: FiltrosBusquedaDto = {};
    const textoLower = texto.toLowerCase();

    // Detectar ciudad
    const ciudades = await this.ciudadRepo.find();
    for (const c of ciudades) {
      if (textoLower.includes(c.nombre.toLowerCase())) {
        filtros.ciudadId = c.id;
        break;
      }
    }

    // Detectar categoría / subcategoría
    const categorias = await this.categoriaRepo.find();
    for (const cat of categorias) {
      if (textoLower.includes(cat.nombre.toLowerCase())) {
        filtros.categoriaId = cat.id;
        break;
      }
    }

    const subcategorias = await this.subcatRepo.find();
    for (const sub of subcategorias) {
      if (textoLower.includes(sub.nombre.toLowerCase())) {
        filtros.subcategoriaId = sub.id;
        break;
      }
    }

    // Detectar si se refiere a "promociones"
    if (textoLower.includes('promocion') || textoLower.includes('oferta')) {
      filtros.promocionesActivas = true;
    }

    // Detectar si se refiere a "abierto ahora" o "mañana"
    if (textoLower.includes('abierto ahora') || textoLower.includes('ahorita')) {
      filtros.abiertoAhora = true;
    }

    // Detectar si se refiere a “cerca de mí”
    if (textoLower.includes('cerca de mi') || textoLower.includes('cercanos')) {
      if (latitud && longitud) {
        filtros.latitud = latitud;
        filtros.longitud = longitud;
      }
    }

    // Retornar resultados usando el BusquedaService
    const resultados = await this.filtrobusquedaService.buscar(filtros);

    return {
      filtros_detectados: filtros,
      resultados,
    };
  }
}
