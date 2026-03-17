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
  ) {}

  // ------------------------------------------------------------
  // STOPWORDS
  // ------------------------------------------------------------
  stopwords = [
    'en','de','del','la','el','los','las','un','una','unos','unas',
    'a','para','por','con','que','mi','mí','me','donde','hay','busca',
    'cerca','cerquita','abierto','ahora','ahorita','promo','promos',
    'oferta','descuento'
  ];

  // ------------------------------------------------------------
  // NORMALIZAR TEXTO
  // ------------------------------------------------------------
  normalizar(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }


  // ------------------------------------------------------------
  // DETECCIÓN SEMÁNTICA
  // ------------------------------------------------------------
  private detectarIntencionSemantica(textoNorm: string): SemanticDetectionResult {
    const serviciosDetectados = new Set<string>();
    const aliasesDetectados = new Set<string>();
    let giroDetectado: string | undefined;

    for (const entrada of this.diccionarioSemantico) {
      const coincidencias = entrada.aliases.filter(alias =>
        textoNorm.includes(this.normalizar(alias)),
      );

      if (coincidencias.length > 0) {
        giroDetectado = giroDetectado || entrada.clave;

        coincidencias.forEach(alias => aliasesDetectados.add(alias));

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
      if (this.normalizar(subcategoria.nombre) === nombreNorm) {
        return subcategoria;
      }
    }

    return null;
  }

  // ------------------------------------------------------------
  // VARIANTES ORTOGRÁFICAS UNIVERSALES
  // ------------------------------------------------------------
  generateMisspellings(word: string): string[] {
    const variantes = new Set<string>();

    // Reglas universales
    variantes.add(word.replace(/s/g, 'z'));
    variantes.add(word.replace(/z/g, 's'));
    variantes.add(word.replace(/c/g, 's'));
    variantes.add(word.replace(/s/g, 'c'));
    variantes.add(word.replace(/sh/g, 'ch'));
    variantes.add(word.replace(/ch/g, 'sh'));
    variantes.add(word.replace(/[aeiou]/g, '')); // quitar vocales

    // Quitar inicio y final
    if (word.length > 3) {
      variantes.add(word.slice(1));
      variantes.add(word.slice(0, -1));
    }

    // Duplicar última letra
    variantes.add(word + word[word.length - 1]);

    // "Correcciones" típicas mexicanas
    variantes.add(word.replace(/ll/g, 'y'));
    variantes.add(word.replace(/y/g, 'll'));

    // Variantes populares generales
    variantes.add(word.replace(/k/g, 'c'));
    variantes.add(word.replace(/c/g, 'k'));
    variantes.add(word.replace(/v/g, 'b'));
    variantes.add(word.replace(/b/g, 'v'));

    return [...variantes].filter(v => v && v.length >= 3);
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

    // Encontrar subcategoría dominante
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

    // Registrar palabra principal
    await this.keywordRepo.save({
      keyword: palabra,
      tipo: 'subcategoria',
      referenciaId: subcategoriaId,
      relevancia: 5,
    });

    console.log(`Nuevo aprendizaje: "${palabra}" → subcategoría ${subcategoriaId}`);

    // Registrar variantes
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
  // INTERPRETAR MENSAJE
  // ------------------------------------------------------------
  async interpretar(
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

  // Para reutilizar preferencias en todo el flujo
  let prefs: any[] | null = null;

  // CIUDAD DEL FRONTEND — PRIORIDAD ABSOLUTA
  if (ciudadManual) {
    filtros.ciudad = ciudadManual;
  } else {
    // DETECTAR CIUDAD EN EL TEXTO (FALLBACK)
    const ciudades = await this.ciudadRepo.find();
    for (const c of ciudades) {
      if (textoNorm.includes(this.normalizar(c.nombre))) {
        filtros.ciudad = c.nombre;
        filtros.ciudadId = Number(c.id);
      }
    }
  }

  // -------------------------------
  // Detectar KEYWORDS
  // -------------------------------
  const palabras = textoNorm
    .split(' ')
    .filter(p => p.length > 2 && !this.stopwords.includes(p));

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

    if (keywordElegida.tipo === 'categoria')
      filtros.categoriaId = Number(keywordElegida.referenciaId);

    if (keywordElegida.tipo === 'subcategoria')
      filtros.subcategoriaId = Number(keywordElegida.referenciaId);

    if (keywordElegida.tipo === 'especialidad') {
      filtros.especialidadId = Number(keywordElegida.referenciaId);
      const esp = await this.especialidadRepo.findOne({
        where: { id: keywordElegida.referenciaId },
        relations: ['subcategoria'],
      });
      if (esp?.subcategoria) filtros.subcategoriaId = esp.subcategoria.id;
    }
  }

  // Fallback semántico:
  // si no hubo keyword suficiente, usar el primer alias detectado
  if (!filtros.q && analisisSemantico.aliasesDetectados.length > 0) {
    filtros.q = analisisSemantico.aliasesDetectados[0];
  }

    // ------------------------------------------------------------
  // MAPEO SEMÁNTICO A CATEGORÍA / SUBCATEGORÍA
  // Solo aplica si la taxonomía no resolvió IDs
  // ------------------------------------------------------------
  if (analisisSemantico.giroDetectado && (!filtros.subcategoriaId || !filtros.categoriaId)) {
    const entradaSemantica = this.diccionarioSemantico.find(
      item => item.clave === analisisSemantico.giroDetectado,
    );

    if (entradaSemantica) {
      // Intentar resolver subcategoría
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

      // Intentar resolver categoría
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

  // -------------------------------
  // Buscar PROMOS
  // -------------------------------
  if (textoNorm.includes('promo') || textoNorm.includes('descuento')) {
    filtros.promos = true;
    filtros.q = filtros.q || 'promociones';
  }

  // -------------------------------
  // Detectar ABIERTO AHORA
  // -------------------------------
  if (
    textoNorm.includes('abierto ahora') ||
    textoNorm.includes('ahorita') ||
    textoNorm.includes('abiertos')
  ) {
    filtros.abiertoAhora = true;
  }

  // -------------------------------
  // Detectar CERCA DE MÍ
  // -------------------------------
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

  // ============================================================
  // APLICAR PREFERENCIAS COMO FILTROS BÁSICOS (SI HAY USUARIO)
  // ============================================================
  if (usuarioId) {
    prefs = await this.usuarioPreferenciasService.obtenerPreferencias(usuarioId);

    if (prefs && prefs.length > 0) {
      // Si no se detectó subcategoría en el mensaje, usar la más frecuente
      const prefSub = prefs.find(p => p.subcategoriaId);
      if (!filtros.subcategoriaId && prefSub) {
        filtros.subcategoriaId = prefSub.subcategoriaId;
      }

      // Si no se detectó categoría, usar categoría preferida
      const prefCat = prefs.find(p => p.categoriaId);
      if (!filtros.categoriaId && prefCat) {
        filtros.categoriaId = prefCat.categoriaId;
      }
    }
  }

  // -------------------------------
  // EJECUTAR BÚSQUEDA
  // -------------------------------
  let resultados = await this.searchService.search({
    q: filtros.q ?? textoNorm,
    ciudad: filtros.ciudad,
    categoriaId: filtros.categoriaId,
    subcategoriaId: filtros.subcategoriaId,
    especialidadId: filtros.especialidadId,
    abiertoAhora: filtros.abiertoAhora ?? false,
    promos: filtros.promos ?? false,
    lat: filtros.lat,
    lng: filtros.lng,
    radioKm: 10,
  });

  // ===============================
  // USAR PREFERENCIAS DEL USUARIO
  // (SOLO SI USUARIO ESTA LOGEADO)
  // ===============================
  if (usuarioId) {
    // Si por alguna razón no se cargaron antes, las obtenemos aquí
    if (!prefs) {
      prefs = await this.usuarioPreferenciasService.obtenerPreferencias(usuarioId);
    }

    if (prefs && resultados.items?.length > 0) {
      resultados.items = resultados.items.map(item => {
        const coincideCat = prefs!.some(p => p.categoriaId === item.categoria_id);
        const coincideSub = prefs!.some(p => p.subcategoriaId === item.subcategoria_id);

        return {
          ...item,
          score_preferencias: coincideSub ? 1 : coincideCat ? 0.7 : 0.3,
        };
      });

      // ORDENA por score de preferencias
      resultados.items.sort(
        (a, b) => (b.score_preferencias ?? 0) - (a.score_preferencias ?? 0),
      );
    }
  }

  if (!resultados || resultados.items.length === 0) {
    resultados = await this.searchService.search({
      q: textoNorm,
      ciudad: filtros.ciudad,
      abiertoAhora: filtros.abiertoAhora ?? false,
      promos: filtros.promos ?? false,
      radioKm: 10,
    });
  }

  // Normalizar promos
  if (resultados.items?.length > 0) {
    resultados.items = resultados.items.map(item => ({
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

  // -------------------------------
  // APRENDER / REFORZAR
  // -------------------------------
  if (!keywordElegida && resultados.items.length > 0)
    await this.aprenderKeyword(textoNorm, resultados);

  if (keywordElegida && resultados.items.length > 0)
    await this.reforzarKeyword(textoNorm, keywordElegida);

  return {
    filtros_detectados: filtros,
    resultados,
  };
}
}