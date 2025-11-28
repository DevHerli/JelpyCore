import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { Ciudad } from '../../../catalogos/ciudades/entities/ciudades.entity';
import { Categoria } from '../../../catalogos/categorias/entities/categorias.entity';
import { Subcategoria } from '../../../catalogos/subcategorias/entities/subcategorias.entity';
import { Especialidad } from '../../../catalogos/especialidades/entities/especialidades.entity';

import { SearchService } from '../../search/search.service';

@Injectable()
export class JelpyAssistantService {
  constructor(
    @InjectRepository(Ciudad)
    private readonly ciudadRepo: Repository<Ciudad>,

    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,

    @InjectRepository(Subcategoria)
    private readonly subcatRepo: Repository<Subcategoria>,

    @InjectRepository(Especialidad)
    private readonly especialidadRepo: Repository<Especialidad>,

    private readonly searchService: SearchService,
  ) {}

  async interpretar(texto: string, latitud?: number, longitud?: number) {
    const filtros: any = {};
    const textoLower = texto.toLowerCase();

    // --------------------------------
    // 🔍 Detectar Ciudad
    // --------------------------------
    const ciudades = await this.ciudadRepo.find();
    for (const c of ciudades) {
      if (textoLower.includes(c.nombre.toLowerCase())) {
        filtros.ciudad = c.nombre;
        filtros.ciudadId = c.id;
        break;
      }
    }

    // --------------------------------
    // 🔍 Detectar Especialidad (PRIORIDAD MÁS ALTA)
    // --------------------------------
    const especialidades = await this.especialidadRepo.find({
      relations: ['subcategoria'],
    });

    for (const esp of especialidades) {
      if (textoLower.includes(esp.nombre.toLowerCase())) {
        filtros.especialidadId = esp.id;
        filtros.subcategoriaId = esp.subcategoria.id;
        filtros.q = esp.nombre;
        break;
      }
    }

    // --------------------------------
    // 🔍 Detectar Subcategoría (solo si no hubo especialidad)
    // --------------------------------
    if (!filtros.especialidadId) {
      const subcategorias = await this.subcatRepo.find();
      for (const sub of subcategorias) {
        if (textoLower.includes(sub.nombre.toLowerCase())) {
          filtros.subcategoriaId = sub.id;
          filtros.q = sub.nombre;
          break;
        }
      }
    }

    // --------------------------------
    // 🔍 Detectar Categoría (solo si no hubo subcategoría)
    // --------------------------------
    if (!filtros.especialidadId && !filtros.subcategoriaId) {
      const categorias = await this.categoriaRepo.find();
      for (const cat of categorias) {
        if (textoLower.includes(cat.nombre.toLowerCase())) {
          filtros.categoriaId = cat.id;
          filtros.q = cat.nombre;
          break;
        }
      }
    }

    // --------------------------------
    // 🔍 Detectar Promos
    // --------------------------------
    if (textoLower.includes('promo') || textoLower.includes('oferta')) {
      filtros.q = filtros.q || 'promo';
      filtros.promocionesActivas = true;
    }

    // --------------------------------
    // 🔍 Detectar "abierto ahora"
    // --------------------------------
    if (textoLower.includes('abierto ahora') || textoLower.includes('ahorita')) {
      filtros.abiertoAhora = true;
    }

    // --------------------------------
    // 🔍 Detectar "cerca de mí"
    // --------------------------------
    if (
      textoLower.includes('cerca de mi') ||
      textoLower.includes('cerca de mí') ||
      textoLower.includes('cercanos')
    ) {
      if (latitud && longitud) {
        filtros.latitud = latitud;
        filtros.longitud = longitud;
      }
    }

    // --------------------------------
    // 🔍 Ejecutar motor de búsqueda REAL
    // --------------------------------
    const resultados = await this.searchService.search({
      q: filtros.q ?? texto,
      ciudad: filtros.ciudad,
      abiertoAhora: filtros.abiertoAhora,
      lat: filtros.latitud,
      lng: filtros.longitud,
      radioKm: 10,
    });

    return {
      filtros_detectados: filtros,
      resultados,
    };
  }
}
