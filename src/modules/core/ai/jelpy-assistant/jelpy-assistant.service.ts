import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { Ciudad } from '../../../catalogos/ciudades/entities/ciudades.entity';
import { Categoria } from '../../../catalogos/categorias/entities/categorias.entity';
import { Subcategoria } from '../../../catalogos/subcategorias/entities/subcategorias.entity';
import { Especialidad } from '../../../catalogos/especialidades/entities/especialidades.entity';

import { KeywordTaxonomia } from '../../taxonomia/entities/keyword-taxonomia.entity';
import { SearchService } from '../../search/search.service';
import { UsuarioPreferenciasService } from '../../preferencias-usuarios/usuario-preferencias.service';

import { JelpyAiService } from '../../../jelpy-ai/jelpy-ai.service';
import { JelpyAiResponse } from '../../../jelpy-ai/interfaces/jelpy-ai-response.interface';

import {
  SemanticCategory,
  SemanticDetectionResult,
} from './interfaces/jelpy-semantic.interfaces';
import { JELPY_SEMANTIC_CATEGORIES } from './constants/jelpy-semantic-categories';

@Injectable()
export class JelpyAssistantService {
  private readonly diccionarioSemantico: SemanticCategory[] = JELPY_SEMANTIC_CATEGORIES;

  constructor(
    @InjectRepository(Ciudad)
    private readonly ciudadRepo: Repository<Ciudad>,

    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,

    @InjectRepository(Subcategoria)
    private readonly subcatRepo: Repository<Subcategoria>,

    @InjectRepository(Especialidad)
    private readonly especialidadRepo: Repository<Especialidad>,

    @InjectRepository(KeywordTaxonomia)
    private readonly keywordRepo: Repository<KeywordTaxonomia>,

    private readonly searchService: SearchService,

    private readonly usuarioPreferenciasService: UsuarioPreferenciasService,

    private readonly jelpyAiService: JelpyAiService,
  ) {}

  // ------------------------------------------------------------
  // STOPWORDS
  // ------------------------------------------------------------
  stopwords = [
    'en', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'a', 'para', 'por', 'con', 'que', 'mi', 'mí', 'me', 'donde', 'hay', 'busca',
    'cerca', 'cerquita', 'abierto', 'ahora', 'ahorita', 'promo', 'promos',
    'oferta', 'descuento',
  ];

  // ------------------------------------------------------------
  // NORMALIZAR TEXTO
  // ------------------------------------------------------------
  normalizar(texto: string): string {
    return (texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  // ------------------------------------------------------------
  // DETECCIÓN SEMÁNTICA (SE CONSERVA PARA FALLBACK LOCAL)
  // ------------------------------------------------------------
  private detectarIntencionSemantica(textoNorm: string): SemanticDetectionResult {
    const serviciosDetectados = new Set<string>();
    const aliasesDetectados = new Set<string>();
    let giroDetectado: string | undefined;

    for (const entrada of this.diccionarioSemantico) {
      const coincidencias = entrada.aliases.filter((alias) =>
        textoNorm.includes(this.normalizar(alias)),
      );

      if (coincidencias.length > 0) {
        giroDetectado = giroDetectado || entrada.clave;

        coincidencias.forEach((alias) => aliasesDetectados.add(alias));

        for (const servicio of entrada.servicios) {
          if (textoNorm.includes(this.normalizar(servicio))) {
            serviciosDetectados.add(servicio);
          }
        }
      }
    }

    return {
      giroDetectado,
      serviciosDetectados: [...serviciosDetectados],
      aliasesDetectados: [...aliasesDetectados],
    };
  }

  // ------------------------------------------------------------
  // BUSCAR CATEGORÍA POR NOMBRE
  // ------------------------------------------------------------
  private async buscarCategoriaPorNombre(nombre: string): Promise<Categoria | null> {
    const categorias = await this.categoriaRepo.find();
    const nombreNorm = this.normalizar(nombre);

    for (const categoria of categorias) {
      if (this.normalizar(categoria.nombre) === nombreNorm) {
        return categoria;
      }
    }

    return null;
  }

  // ------------------------------------------------------------
  // BUSCAR SUBCATEGORÍA POR NOMBRE
  // ------------------------------------------------------------
  private async buscarSubcategoriaPorNombre(nombre: string): Promise<Subcategoria | null> {
    const subcategorias = await this.subcatRepo.find({
      relations: ['categoria'],
    });
  
    const nombreNorm = this.normalizar(nombre);
  
    for (const subcategoria of subcategorias) {
      const subNorm = this.normalizar(subcategoria.nombre);
  
      if (
        subNorm === nombreNorm ||
        subNorm.includes(nombreNorm) ||
        nombreNorm.includes(subNorm)
      ) {
        return subcategoria;
      }
    }
  
    return null;
  }

  // ------------------------------------------------------------
  // BUSCAR ESPECIALIDAD POR NOMBRE
  // ------------------------------------------------------------
  private async buscarEspecialidadPorNombre(nombre: string): Promise<Especialidad | null> {
    const especialidades = await this.especialidadRepo.find({
      relations: ['subcategoria'],
    });

    const nombreNorm = this.normalizar(nombre);

    for (const especialidad of especialidades) {
      if (this.normalizar(especialidad.nombre) === nombreNorm) {
        return especialidad;
      }
    }

    return null;
  }

  // ------------------------------------------------------------
  // VARIANTES ORTOGRÁFICAS UNIVERSALES
  // ------------------------------------------------------------
  generateMisspellings(word: string): string[] {
    const variantes = new Set<string>();

    variantes.add(word.replace(/s/g, 'z'));
    variantes.add(word.replace(/z/g, 's'));
    variantes.add(word.replace(/c/g, 's'));
    variantes.add(word.replace(/s/g, 'c'));
    variantes.add(word.replace(/sh/g, 'ch'));
    variantes.add(word.replace(/ch/g, 'sh'));
    variantes.add(word.replace(/[aeiou]/g, ''));

    if (word.length > 3) {
      variantes.add(word.slice(1));
      variantes.add(word.slice(0, -1));
    }

    variantes.add(word + word[word.length - 1]);

    variantes.add(word.replace(/ll/g, 'y'));
    variantes.add(word.replace(/y/g, 'll'));

    variantes.add(word.replace(/k/g, 'c'));
    variantes.add(word.replace(/c/g, 'k'));
    variantes.add(word.replace(/v/g, 'b'));
    variantes.add(word.replace(/b/g, 'v'));

    return [...variantes].filter((v) => v && v.length >= 3);
  }

  // ------------------------------------------------------------
  // AUTOAPRENDIZAJE
  // ------------------------------------------------------------
  async aprenderKeyword(term: string, results: any) {
    const palabra = this.normalizar(term);

    if (palabra.length < 3 || this.stopwords.includes(palabra)) return;

    const existe = await this.keywordRepo.findOne({
      where: { keyword: palabra },
    });
    if (existe) return;

    const conteo: Record<number, number> = {};
    for (const item of results.items) {
      if (item.subcategoria_id) {
        conteo[item.subcategoria_id] =
          (conteo[item.subcategoria_id] || 0) + 1;
      }
    }

    const dominante = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];
    if (!dominante) return;

    const subcategoriaId = Number(dominante[0]);

    await this.keywordRepo.save({
      keyword: palabra,
      tipo: 'subcategoria',
      referenciaId: subcategoriaId,
      relevancia: 5,
    });

    console.log(`Nuevo aprendizaje: "${palabra}" → subcategoría ${subcategoriaId}`);

    const variantes = this.generateMisspellings(palabra);
    for (const variante of variantes) {
      await this.keywordRepo.save({
        keyword: variante,
        tipo: 'subcategoria',
        referenciaId: subcategoriaId,
        relevancia: 2,
      });
    }
  }

  // ------------------------------------------------------------
  // REFORZAR KEYWORD EXISTENTE
  // ------------------------------------------------------------
  async reforzarKeyword(term: string, keyword: KeywordTaxonomia) {
    const palabra = this.normalizar(term);
    if (palabra !== keyword.keyword) return;

    keyword.relevancia = Math.min(15, (keyword.relevancia ?? 1) + 1);
    await this.keywordRepo.save(keyword);

    console.log(`⚡ Reforzada: "${palabra}" → relevancia ${keyword.relevancia}`);
  }

  // ------------------------------------------------------------
  // NUEVO: NORMALIZAR INTENCIÓN EN SALUD
  // ------------------------------------------------------------
  private normalizarIntentSalud(
    ai: JelpyAiResponse,
    filtros: any,
  ) {
    const textoBase =
      ai.normalized_text ||
      filtros.q ||
      ai.entities?.especialidad ||
      ai.entities?.subcategoria ||
      ai.entities?.categoria ||
      '';

    const textoNorm = this.normalizar(textoBase);

    const esBusquedaDoctor =
      textoNorm.includes('doctor') ||
      textoNorm.includes('doctora') ||
      textoNorm.includes('dentista') ||
      textoNorm.includes('pediatra') ||
      textoNorm.includes('ginecologo') ||
      textoNorm.includes('ginecólogo') ||
      textoNorm.includes('cardiologo') ||
      textoNorm.includes('cardiólogo') ||
      textoNorm.includes('dermatologo') ||
      textoNorm.includes('dermatólogo') ||
      textoNorm.includes('traumatologo') ||
      textoNorm.includes('traumatólogo') ||
      textoNorm.includes('especialista') ||
      textoNorm.includes('consulta medica') ||
      textoNorm.includes('consulta médica');

    const esNegocioSalud =
      textoNorm.includes('hospital') ||
      textoNorm.includes('clinica') ||
      textoNorm.includes('clínica') ||
      textoNorm.includes('farmacia') ||
      textoNorm.includes('laboratorio') ||
      textoNorm.includes('urgencias') ||
      textoNorm.includes('rayos x') ||
      textoNorm.includes('ultrasonido');

    if (esNegocioSalud) {
      filtros.intent = 'buscar_negocios';

      // Evita que hospital/farmacia/laboratorio/clinica
      // se amarren a una especialidad o a una subcategoría de doctores
      filtros.especialidadId = undefined;
      filtros.subcategoriaId = undefined;
      return;
    }

    if (esBusquedaDoctor) {
      filtros.intent = 'buscar_doctores';
    }
  }

  // ------------------------------------------------------------
  // MAPEAR RESPUESTA DE FASTAPI A FILTROS REALES
  // ------------------------------------------------------------
//   private async mapearFastApiAFiltros(
//     ai: JelpyAiResponse,
//     ciudadManual?: string,
//   ) {
//     const filtros: any = {};

//     const ciudadDetectada = ciudadManual || ai.entities?.ciudad || null;
//     if (ciudadDetectada) {
//       filtros.ciudad = ciudadDetectada;

//       const ciudad = await this.ciudadRepo
//         .createQueryBuilder('c')
//         .where('LOWER(c.nombre) = LOWER(:nombre)', { nombre: ciudadDetectada })
//         .getOne();

//       if (ciudad) {
//         filtros.ciudadId = Number(ciudad.id);
//       }
//     }

//     if (ai.filters?.abierto_ahora) {
//       filtros.abiertoAhora = true;
//     }

//     if (ai.filters?.promos || ai.intent === 'buscar_promociones') {
//       filtros.promos = true;
//     }

//     if (ai.filters?.cerca_de_mi) {
//       filtros.cercaDeMi = true;
//     }

//     if (ai.entities?.categoria) {
//       const categoria = await this.buscarCategoriaPorNombre(ai.entities.categoria);
//       if (categoria) {
//         filtros.categoriaId = Number(categoria.id);
//       }
//     }

//     if (ai.entities?.subcategoria) {
//       const subcategoria = await this.buscarSubcategoriaPorNombre(ai.entities.subcategoria);
//       if (subcategoria) {
//         filtros.subcategoriaId = Number(subcategoria.id);

//         if (!filtros.categoriaId && subcategoria.categoria?.id) {
//           filtros.categoriaId = Number(subcategoria.categoria.id);
//         }
//       }
//     }

//     if (ai.entities?.especialidad) {
//       const especialidad = await this.buscarEspecialidadPorNombre(ai.entities.especialidad);
//       if (especialidad) {
//         filtros.especialidadId = Number(especialidad.id);

//         if (!filtros.subcategoriaId && especialidad.subcategoria?.id) {
//           filtros.subcategoriaId = Number(especialidad.subcategoria.id);
//         }
//       }
//     }

//     // filtros.q =
//     //   ai.entities?.especialidad ||
//     //   ai.entities?.subcategoria ||
//     //   ai.entities?.categoria ||
//     //   ai.normalized_text ||
//     //   '';

//     // const qNormalizada = String(filtros.q || '').trim().toLowerCase();

//     const textoNormalizado = ai.normalized_text || '';
// const entidadPrincipal =
//   ai.entities?.especialidad ||
//   ai.entities?.subcategoria ||
//   ai.entities?.categoria ||
//   '';

// const entidadNorm = this.normalizar(entidadPrincipal);
// const textoNormCompleto = this.normalizar(textoNormalizado);

// // Si el texto completo trae más contexto que solo la entidad,
// // conservamos todo el texto para que SearchService pueda filtrar
// // por características, items, promos, etc.
// if (textoNormCompleto && entidadNorm && textoNormCompleto !== entidadNorm) {
//   filtros.q = textoNormalizado;
// } else {
//   filtros.q =
//     ai.entities?.especialidad ||
//     ai.entities?.subcategoria ||
//     ai.entities?.categoria ||
//     ai.normalized_text ||
//     '';
// }

// const qNormalizada = String(filtros.q || '').trim().toLowerCase();

//     if (
//       ai.intent === 'buscar_promociones' &&
//       ['promocion', 'promociones', 'promo', 'promos', 'oferta', 'ofertas', 'descuento', 'descuentos'].includes(qNormalizada)
//     ) {
//       filtros.q = undefined;
//     }

//     filtros.intent = ai.intent;
//     filtros.confidence = ai.confidence;
//     filtros.normalizedText = ai.normalized_text;

//     return filtros;
//   }

  private async mapearFastApiAFiltros(
    ai: JelpyAiResponse,
    ciudadManual?: string,
  ) {
    const filtros: any = {};

    const ciudadDetectada = ciudadManual || ai.entities?.ciudad || null;
    if (ciudadDetectada) {
      filtros.ciudad = ciudadDetectada;

      const ciudad = await this.ciudadRepo
        .createQueryBuilder('c')
        .where('LOWER(c.nombre) = LOWER(:nombre)', { nombre: ciudadDetectada })
        .getOne();

      if (ciudad) {
        filtros.ciudadId = Number(ciudad.id);
      }
    }

    if (ai.filters?.abierto_ahora) {
      filtros.abiertoAhora = true;
    }

    if (ai.filters?.promos || ai.intent === 'buscar_promociones') {
      filtros.promos = true;
    }

    if (ai.filters?.cerca_de_mi) {
      filtros.cercaDeMi = true;
    }

    if (ai.entities?.categoria) {
      const categoria = await this.buscarCategoriaPorNombre(ai.entities.categoria);
      if (categoria) {
        filtros.categoriaId = Number(categoria.id);
      }
    }

    if (ai.entities?.subcategoria) {
      const subcategoria = await this.buscarSubcategoriaPorNombre(
        ai.entities.subcategoria,
      );
      if (subcategoria) {
        filtros.subcategoriaId = Number(subcategoria.id);

        if (!filtros.categoriaId && subcategoria.categoria?.id) {
          filtros.categoriaId = Number(subcategoria.categoria.id);
        }
      }
    }

    if (ai.entities?.especialidad) {
      const especialidad = await this.buscarEspecialidadPorNombre(
        ai.entities.especialidad,
      );
      if (especialidad) {
        filtros.especialidadId = Number(especialidad.id);

        if (!filtros.subcategoriaId && especialidad.subcategoria?.id) {
          filtros.subcategoriaId = Number(especialidad.subcategoria.id);
        }
      }
    }

    if ((ai.entities as any)?.caracteristica) {
      filtros.caracteristica = String(
        (ai.entities as any).caracteristica,
      ).trim();
    }

    const textoNormalizado = ai.normalized_text || '';
    const entidadPrincipal =
      ai.entities?.especialidad ||
      ai.entities?.subcategoria ||
      ai.entities?.categoria ||
      '';

    const entidadNorm = this.normalizar(entidadPrincipal);
    const textoNormCompleto = this.normalizar(textoNormalizado);

    if (textoNormCompleto && entidadNorm && textoNormCompleto !== entidadNorm) {
      filtros.q = textoNormalizado;
    } else {
      filtros.q =
        ai.entities?.especialidad ||
        ai.entities?.subcategoria ||
        ai.entities?.categoria ||
        ai.normalized_text ||
        '';
    }

    // NUEVO:
    // Si la búsqueda viene orientada a característica y FastAPI NO detectó
    // subcategoría/especialidad explícitas, no forzamos esos filtros.
    // Esto evita amarrar la consulta a una subcategoría incorrecta.
    const soloCaracteristica =
      !!filtros.caracteristica &&
      !ai.entities?.subcategoria &&
      !ai.entities?.especialidad;

    if (soloCaracteristica) {
      filtros.subcategoriaId = undefined;
      filtros.especialidadId = undefined;
    }

    const qNormalizada = String(filtros.q || '').trim().toLowerCase();

    if (
      ai.intent === 'buscar_promociones' &&
      [
        'promocion',
        'promociones',
        'promo',
        'promos',
        'oferta',
        'ofertas',
        'descuento',
        'descuentos',
      ].includes(qNormalizada)
    ) {
      filtros.q = undefined;
    }

    filtros.intent = ai.intent;
    filtros.confidence = ai.confidence;
    filtros.normalizedText = ai.normalized_text;

    // NUEVO: separar doctores vs negocios de salud
    this.normalizarIntentSalud(ai, filtros);

    return filtros;
  }

  // ------------------------------------------------------------
  // APLICAR COORDENADAS SOLO SI CORRESPONDE
  // ------------------------------------------------------------
  private aplicarCoordenadasSiCorresponde(
    filtros: any,
    latitud?: number,
    longitud?: number,
  ) {
    if (filtros.cercaDeMi && latitud && longitud) {
      filtros.lat = latitud;
      filtros.lng = longitud;
    }
  }

  // ------------------------------------------------------------
  // APLICAR PREFERENCIAS DEL USUARIO
  // ------------------------------------------------------------
//   private async aplicarPreferenciasUsuario(
//     filtros: any,
//     usuarioId?: number,
//   ): Promise<any[] | null> {
//     if (!usuarioId) return null;

//     const prefs = await this.usuarioPreferenciasService.obtenerPreferencias(usuarioId);

//     if (
//       filtros.intent === 'buscar_promociones' &&
//       !filtros.categoriaId &&
//       !filtros.subcategoriaId &&
//       !filtros.especialidadId
//     ) {
//       return prefs;
//     }

//     if (prefs && prefs.length > 0) {
// const prefSub = prefs.find((p) => p.subcategoriaId);
// if (!filtros.subcategoriaId && prefSub) {
//   filtros.subcategoriaId = Number(prefSub.subcategoriaId);
// }

// const prefCat = prefs.find((p) => p.categoriaId);
// if (!filtros.categoriaId && prefCat) {
//   filtros.categoriaId = Number(prefCat.categoriaId);
// }
//     }

//     return prefs;
//   }

private async aplicarPreferenciasUsuario(
  filtros: any,
  usuarioId?: number,
): Promise<any[] | null> {
  if (!usuarioId) return null;

  const prefs = await this.usuarioPreferenciasService.obtenerPreferencias(usuarioId);

  if (
    filtros.intent === 'buscar_promociones' &&
    !filtros.categoriaId &&
    !filtros.subcategoriaId &&
    !filtros.especialidadId
  ) {
    return prefs;
  }

  const busquedaExplicita =
    !!filtros.q ||
    !!filtros.categoriaId ||
    !!filtros.subcategoriaId ||
    !!filtros.especialidadId;

  if (busquedaExplicita) {
    return prefs;
  }

  const busquedaOrientadaACaracteristica =
    !!filtros.caracteristica &&
    !filtros.subcategoriaId &&
    !filtros.especialidadId;

  if (busquedaOrientadaACaracteristica) {
    return prefs;
  }

  if (prefs && prefs.length > 0) {
    const prefSub = prefs.find((p) => p.subcategoriaId);
    if (!filtros.subcategoriaId && prefSub) {
      filtros.subcategoriaId = Number(prefSub.subcategoriaId);
    }

    const prefCat = prefs.find((p) => p.categoriaId);
    if (!filtros.categoriaId && prefCat) {
      filtros.categoriaId = Number(prefCat.categoriaId);
    }
  }

  return prefs;
}

  // ------------------------------------------------------------
  // ORDENAR RESULTADOS POR PREFERENCIAS
  // ------------------------------------------------------------
  private ordenarResultadosPorPreferencias(resultados: any, prefs: any[] | null) {
    if (!prefs || !resultados?.items?.length) return resultados;

    resultados.items = resultados.items.map((item) => {
      const coincideCat = prefs.some((p) => p.categoriaId === item.categoria_id);
      const coincideSub = prefs.some((p) => p.subcategoriaId === item.subcategoria_id);

      return {
        ...item,
        score_preferencias: coincideSub ? 1 : coincideCat ? 0.7 : 0.3,
      };
    });

    resultados.items.sort(
      (a, b) => (b.score_preferencias ?? 0) - (a.score_preferencias ?? 0),
    );

    return resultados;
  }

  // ------------------------------------------------------------
  // INTERPRETAR MENSAJE
  // NUEVO FLUJO: FASTAPI PRIMERO, FALLBACK LOCAL SI FALLA
  // ------------------------------------------------------------
  async interpretar(
    texto: string,
    latitud?: number,
    longitud?: number,
    ciudadManual?: string,
    usuarioId?: number,
  ) {
    let filtros: any = {};
    let prefs: any[] | null = null;

    const textoNorm = this.normalizar(texto);

    try {
      // ============================================================
      // 1. INTERPRETAR CON FASTAPI
      // ============================================================
      const ai = await this.jelpyAiService.interpretar({
        text: texto,
        city_hint: ciudadManual ?? null,
        lat: latitud ?? null,
        lng: longitud ?? null,
        user_id: usuarioId ?? null,
      });

      // ============================================================
      // 2. MAPEAR RESPUESTA A FILTROS REALES DE NEST
      // ============================================================
      filtros = await this.mapearFastApiAFiltros(ai, ciudadManual);

      // ============================================================
      // 3. APLICAR COORDENADAS SI PIDIÓ CERCA DE MÍ
      // ============================================================
      this.aplicarCoordenadasSiCorresponde(filtros, latitud, longitud);

      // ============================================================
      // 4. APLICAR PREFERENCIAS DEL USUARIO
      // ============================================================
      prefs = await this.aplicarPreferenciasUsuario(filtros, usuarioId);

      // ============================================================
      // 5. EJECUTAR BÚSQUEDA REAL
      // ============================================================
      let resultados: any = await this.searchService.search({
        q: filtros.q ?? textoNorm,
        ciudad: filtros.ciudad,
        categoriaId: filtros.categoriaId,
        subcategoriaId: filtros.subcategoriaId,
        especialidadId: filtros.especialidadId,
        abiertoAhora: filtros.abiertoAhora ?? false,
        promos: filtros.promos ?? false,
        caracteristica: filtros.caracteristica,
        lat: filtros.lat,
        lng: filtros.lng,
        radioKm: 10,
      });

      // ============================================================
      // 5.1 FALLBACK A BÚSQUEDA POR ITEMS_NEGOCIO
      // ============================================================
      if (!resultados || resultados.items.length === 0) {
        const resultadosItems = await this.searchService.searchByItems({
          q: filtros.q ?? textoNorm,
          ciudad: filtros.ciudad,
          lat: filtros.lat,
          lng: filtros.lng,
          radioKm: 10,
        });

        if (resultadosItems?.items?.length > 0) {
          resultados = resultadosItems;
          filtros.intent = 'buscar_items_negocio';
        }
      }

      // ============================================================
      // 6. ORDENAR POR PREFERENCIAS
      // ============================================================
      resultados = this.ordenarResultadosPorPreferencias(resultados, prefs);

      // ============================================================
      // 7. FALLBACK DE BÚSQUEDA SI NO HAY RESULTADOS
      // ============================================================
      if (!resultados || resultados.items.length === 0) {
        resultados = await this.searchService.search({
          q: textoNorm,
          ciudad: filtros.ciudad,
          categoriaId: filtros.categoriaId,
          subcategoriaId: filtros.subcategoriaId,
          especialidadId: filtros.especialidadId,
          caracteristica: filtros.caracteristica,
          abiertoAhora: filtros.abiertoAhora ?? false,
          promos: filtros.promos ?? false,
          radioKm: 10,
        });

        // ============================================================
        // 7.1 SEGUNDO FALLBACK A ITEMS_NEGOCIO
        // ============================================================
        if (!resultados || resultados.items.length === 0) {
          const resultadosItems = await this.searchService.searchByItems({
            q: textoNorm,
            ciudad: filtros.ciudad,
            lat: filtros.lat,
            lng: filtros.lng,
            radioKm: 10,
          });

          if (resultadosItems?.items?.length > 0) {
            resultados = resultadosItems;
            filtros.intent = 'buscar_items_negocio';
          }
        }
      }

      // ============================================================
      // 8. NORMALIZAR PROMOS
      // ============================================================
      if (resultados.items?.length > 0) {
        resultados.items = resultados.items.map((item) => ({
          ...item,
          promo: item.promo
            ? {
                titulo: item.promo.titulo,
                desde: item.promo.desde,
                hasta: item.promo.hasta,
              }
            : null,
        }));
      }

      // ============================================================
      // 9. APRENDIZAJE TEMPORALMENTE CONSERVADO
      // ============================================================
      if (resultados.items.length > 0) {
        await this.aprenderKeyword(textoNorm, resultados);
      }

      return {
        filtros_detectados: filtros,
        resultados,
      };
    } catch (error) {
      console.warn(
        '⚠️ FastAPI no respondió correctamente, usando fallback local.',
        error?.message || error,
      );

      return this.interpretarFallbackLocal(
        texto,
        latitud,
        longitud,
        ciudadManual,
        usuarioId,
      );
    }
  }

  private async interpretarFallbackLocal(
    texto: string,
    latitud?: number,
    longitud?: number,
    ciudadManual?: string,
    usuarioId?: number,
  ) {
    const filtros: any = {};
    const textoNorm = this.normalizar(texto);
    const analisisSemantico = this.detectarIntencionSemantica(textoNorm);

    filtros.giroDetectado = analisisSemantico.giroDetectado;
    filtros.serviciosDetectados = analisisSemantico.serviciosDetectados;
    filtros.aliasesDetectados = analisisSemantico.aliasesDetectados;

    // NUEVO: detectar característica simple en fallback local
    if (textoNorm.includes('comida para llevar')) {
      filtros.caracteristica = 'comida para llevar';
    } else if (textoNorm.includes('estacionamiento')) {
      filtros.caracteristica = 'estacionamiento';
    } else if (
      textoNorm.includes('lugar familiar') ||
      textoNorm.includes('area familiar') ||
      textoNorm.includes('área familiar')
    ) {
      filtros.caracteristica = 'lugar familiar';
    }

    let prefs: any[] | null = null;

    if (ciudadManual) {
      filtros.ciudad = ciudadManual;
    } else {
      const ciudades = await this.ciudadRepo.find();
      for (const c of ciudades) {
        if (textoNorm.includes(this.normalizar(c.nombre))) {
          filtros.ciudad = c.nombre;
          filtros.ciudadId = Number(c.id);
        }
      }
    }

    const palabras = textoNorm
      .split(' ')
      .filter((p) => p.length > 2 && !this.stopwords.includes(p));

    let keywordsEncontrados: KeywordTaxonomia[] = [];

    for (const palabra of palabras) {
      const lista = await this.keywordRepo
        .createQueryBuilder('k')
        .where(
          `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(k.keyword),
        'á','a'),'é','e'),'í','i'),'ó','o'),'ú','u') LIKE :q`,
          { q: `%${palabra}%` },
        )
        .orderBy('k.relevancia', 'DESC')
        .getMany();

      if (lista.length > 0) keywordsEncontrados.push(...lista);
    }

    let keywordElegida: KeywordTaxonomia | null = null;

    if (keywordsEncontrados.length > 0) {
      keywordElegida = keywordsEncontrados.sort(
        (a, b) => b.relevancia - a.relevancia,
      )[0];

      filtros.q = keywordElegida.keyword;

      if (keywordElegida.tipo === 'categoria') {
        filtros.categoriaId = Number(keywordElegida.referenciaId);
      }

      if (keywordElegida.tipo === 'subcategoria') {
        filtros.subcategoriaId = Number(keywordElegida.referenciaId);
      }

      if (keywordElegida.tipo === 'especialidad') {
        filtros.especialidadId = Number(keywordElegida.referenciaId);
        const esp = await this.especialidadRepo.findOne({
          where: { id: keywordElegida.referenciaId },
          relations: ['subcategoria'],
        });
        if (esp?.subcategoria) {
          filtros.subcategoriaId = Number(esp.subcategoria.id);
        }
      }
    }

    if (!filtros.q && analisisSemantico.aliasesDetectados.length > 0) {
      filtros.q = analisisSemantico.aliasesDetectados[0];
    }

    if (
      analisisSemantico.giroDetectado &&
      (!filtros.subcategoriaId || !filtros.categoriaId)
    ) {
      const entradaSemantica = this.diccionarioSemantico.find(
        (item) => item.clave === analisisSemantico.giroDetectado,
      );

      if (entradaSemantica) {
        if (!filtros.subcategoriaId && entradaSemantica.subcategoriaHint) {
          const subcategoria = await this.buscarSubcategoriaPorNombre(
            entradaSemantica.subcategoriaHint,
          );

          if (subcategoria) {
            filtros.subcategoriaId = Number(subcategoria.id);

            if (!filtros.categoriaId && subcategoria.categoria?.id) {
              filtros.categoriaId = Number(subcategoria.categoria.id);
            }
          }
        }

        if (!filtros.categoriaId && entradaSemantica.categoriaHint) {
          const categoria = await this.buscarCategoriaPorNombre(
            entradaSemantica.categoriaHint,
          );

          if (categoria) {
            filtros.categoriaId = Number(categoria.id);
          }
        }
      }
    }

    if (textoNorm.includes('promo') || textoNorm.includes('descuento')) {
      filtros.promos = true;
      filtros.q = filtros.q || 'promociones';
    }

    const qFallbackNormalizada = String(filtros.q || '').trim().toLowerCase();

    if (
      filtros.promos &&
      [
        'promocion',
        'promociones',
        'promo',
        'promos',
        'oferta',
        'ofertas',
        'descuento',
        'descuentos',
      ].includes(qFallbackNormalizada)
    ) {
      filtros.q = undefined;
    }

    if (
      textoNorm.includes('abierto ahora') ||
      textoNorm.includes('ahorita') ||
      textoNorm.includes('abiertos')
    ) {
      filtros.abiertoAhora = true;
    }

    if (
      textoNorm.includes('cerca de mi') ||
      textoNorm.includes('cerca de mí') ||
      textoNorm.includes('cercanos') ||
      textoNorm.includes('cerca')
    ) {
      if (latitud && longitud) {
        filtros.lat = latitud;
        filtros.lng = longitud;
      }
    }

    if (usuarioId) {
      prefs = await this.usuarioPreferenciasService.obtenerPreferencias(usuarioId);

      const esPromoGenerica =
        filtros.promos &&
        !filtros.categoriaId &&
        !filtros.subcategoriaId &&
        !filtros.especialidadId;

      if (!esPromoGenerica && prefs && prefs.length > 0) {
        const prefSub = prefs.find((p) => p.subcategoriaId);
        if (!filtros.subcategoriaId && prefSub) {
          filtros.subcategoriaId = Number(prefSub.subcategoriaId);
        }

        const prefCat = prefs.find((p) => p.categoriaId);
        if (!filtros.categoriaId && prefCat) {
          filtros.categoriaId = Number(prefCat.categoriaId);
        }
      }
    }

    let resultados: any = await this.searchService.search({
      q: filtros.q ?? textoNorm,
      ciudad: filtros.ciudad,
      categoriaId: filtros.categoriaId,
      subcategoriaId: filtros.subcategoriaId,
      especialidadId: filtros.especialidadId,
      caracteristica: filtros.caracteristica,
      abiertoAhora: filtros.abiertoAhora ?? false,
      promos: filtros.promos ?? false,
      lat: filtros.lat,
      lng: filtros.lng,
      radioKm: 10,
    });

    if (!resultados || resultados.items.length === 0) {
      const resultadosItems = await this.searchService.searchByItems({
        q: filtros.q ?? textoNorm,
        ciudad: filtros.ciudad,
        lat: filtros.lat,
        lng: filtros.lng,
        radioKm: 10,
      });

      if (resultadosItems?.items?.length > 0) {
        resultados = resultadosItems;
        filtros.intent = 'buscar_items_negocio';
      }
    }

    resultados = this.ordenarResultadosPorPreferencias(resultados, prefs);

    if (!resultados || resultados.items.length === 0) {
      resultados = await this.searchService.search({
        q: textoNorm,
        ciudad: filtros.ciudad,
        categoriaId: filtros.categoriaId,
        subcategoriaId: filtros.subcategoriaId,
        especialidadId: filtros.especialidadId,
        caracteristica: filtros.caracteristica,
        abiertoAhora: filtros.abiertoAhora ?? false,
        promos: filtros.promos ?? false,
        radioKm: 10,
      });

      if (!resultados || resultados.items.length === 0) {
        const resultadosItems = await this.searchService.searchByItems({
          q: textoNorm,
          ciudad: filtros.ciudad,
          lat: filtros.lat,
          lng: filtros.lng,
          radioKm: 10,
        });

        if (resultadosItems?.items?.length > 0) {
          resultados = resultadosItems;
          filtros.intent = 'buscar_items_negocio';
        }
      }
    }

    if (resultados.items?.length > 0) {
      resultados.items = resultados.items.map((item) => ({
        ...item,
        promo: item.promo
          ? {
              titulo: item.promo.titulo,
              desde: item.promo.desde,
              hasta: item.promo.hasta,
            }
          : null,
      }));
    }

    if (!keywordElegida && resultados.items.length > 0) {
      await this.aprenderKeyword(textoNorm, resultados);
    }

    if (keywordElegida && resultados.items.length > 0) {
      await this.reforzarKeyword(textoNorm, keywordElegida);
    }

    return {
      filtros_detectados: filtros,
      resultados,
    };
  }
}