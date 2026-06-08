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

import { CaracteristicaSucursal } from '../../../business/caracteristicas_sucursales/entities/caracteristica-sucursal.entity';
import { CaracteristicaAlias } from '../../../business/caracteristicas_sucursales/entities/caracteristica-alias.entity';

type CaracteristicaDetectada = {
  id: number;
  nombre: string;
  codigo: string;
  aliasDetectado: string;
  aliasNormalizado: string;
};

@Injectable()
export class JelpyAssistantService {
  private readonly diccionarioSemantico: SemanticCategory[] =
    JELPY_SEMANTIC_CATEGORIES;

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

    @InjectRepository(CaracteristicaSucursal)
    private readonly caracteristicaRepo: Repository<CaracteristicaSucursal>,

    @InjectRepository(CaracteristicaAlias)
    private readonly caracteristicaAliasRepo: Repository<CaracteristicaAlias>,

    private readonly searchService: SearchService,

    private readonly usuarioPreferenciasService: UsuarioPreferenciasService,

    private readonly jelpyAiService: JelpyAiService,
  ) {}

  stopwords = [
    'en', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'a', 'para', 'por', 'con', 'que', 'mi', 'mí', 'me', 'donde', 'hay', 'busca',
    'buscas', 'buscar', 'quiero', 'quieres', 'quieras', 'necesito',
    'cerca', 'cerquita', 'abierto', 'ahora', 'ahorita', 'promo', 'promos',
    'oferta', 'descuento',
  ];

  normalizar(texto: string): string {
    return (texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

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

  async aprenderKeyword(term: string, results: any) {
    const palabra = this.normalizar(term);

    if (palabra.length < 3 || this.stopwords.includes(palabra)) return;

    const existe = await this.keywordRepo.findOne({
      where: { keyword: palabra },
    });

    if (existe) return;

    const conteo: Record<number, number> = {};

    for (const item of results.items ?? []) {
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

  async reforzarKeyword(term: string, keyword: KeywordTaxonomia) {
    const palabra = this.normalizar(term);

    if (palabra !== keyword.keyword) return;

    keyword.relevancia = Math.min(15, (keyword.relevancia ?? 1) + 1);
    await this.keywordRepo.save(keyword);

    console.log(`⚡ Reforzada: "${palabra}" → relevancia ${keyword.relevancia}`);
  }

  private normalizarIntentSalud(ai: JelpyAiResponse, filtros: any) {
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
      filtros.especialidadId = undefined;
      filtros.subcategoriaId = undefined;
      return;
    }

    if (esBusquedaDoctor) {
      filtros.intent = 'buscar_doctores';
    }
  }

  private async detectarCaracteristicaDesdeBD(
    texto: string,
  ): Promise<CaracteristicaDetectada | null> {
    const textoNorm = this.normalizar(texto);

    if (!textoNorm) return null;

    const [caracteristicas, aliases] = await Promise.all([
      this.caracteristicaRepo.find({
        where: { activo: true },
      }),
      this.caracteristicaAliasRepo.find({
        where: { activo: true },
        relations: ['caracteristica'],
      }),
    ]);

    const candidatos: CaracteristicaDetectada[] = [];

    for (const c of caracteristicas) {
      candidatos.push({
        id: Number(c.id),
        nombre: c.nombre,
        codigo: c.codigo,
        aliasDetectado: c.nombre,
        aliasNormalizado: this.normalizar(c.nombre),
      });

      candidatos.push({
        id: Number(c.id),
        nombre: c.nombre,
        codigo: c.codigo,
        aliasDetectado: c.codigo,
        aliasNormalizado: this.normalizar(c.codigo),
      });
    }

    for (const a of aliases) {
      const caracteristica = a.caracteristica;

      if (!caracteristica?.activo) continue;

      candidatos.push({
        id: Number(caracteristica.id),
        nombre: caracteristica.nombre,
        codigo: caracteristica.codigo,
        aliasDetectado: a.alias,
        aliasNormalizado: this.normalizar(a.alias),
      });
    }

    candidatos.sort(
      (a, b) => b.aliasNormalizado.length - a.aliasNormalizado.length,
    );

    for (const candidato of candidatos) {
      if (!candidato.aliasNormalizado || candidato.aliasNormalizado.length < 3) {
        continue;
      }

      if (textoNorm.includes(candidato.aliasNormalizado)) {
        return candidato;
      }
    }

    return null;
  }

  private limpiarTextoSinCaracteristica(
    texto: string,
    caracteristica: CaracteristicaDetectada,
  ): string {
    let limpio = this.normalizar(texto);

    const posiblesValores = [
      caracteristica.aliasDetectado,
      caracteristica.nombre,
      caracteristica.codigo,
    ]
      .map((x) => this.normalizar(x))
      .filter(Boolean);

    for (const valor of posiblesValores) {
      limpio = limpio.replace(valor, ' ');
    }

    return limpio
      .split(/\s+/)
      .map((x) => x.trim())
      .filter((x) => x.length > 2)
      .filter((x) => !this.stopwords.includes(x))
      .join(' ')
      .trim();
  }

  private resolveQueryForSearch(filtros: any, textoNorm: string): string | undefined {
    if (filtros.caracteristica && !filtros.q) {
      return undefined;
    }

    return filtros.q ?? textoNorm;
  }

  private hasResults(resultados: any): boolean {
    return Array.isArray(resultados?.items) && resultados.items.length > 0;
  }

  private normalizarPromosEnResultados(resultados: any) {
    if (!Array.isArray(resultados?.items) || resultados.items.length === 0) {
      return resultados;
    }

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

    return resultados;
  }

  private async mapearFastApiAFiltros(
    ai: JelpyAiResponse,
    ciudadManual?: string,
    textoOriginal?: string,
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
      filtros.caracteristica = String((ai.entities as any).caracteristica).trim();
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

    const caracteristicaBD = await this.detectarCaracteristicaDesdeBD(
      textoOriginal || ai.normalized_text || '',
    );

    if (caracteristicaBD) {
      filtros.caracteristica = caracteristicaBD.nombre;

      const qSinCaracteristica = this.limpiarTextoSinCaracteristica(
        textoOriginal || ai.normalized_text || '',
        caracteristicaBD,
      );

      filtros.q = qSinCaracteristica || undefined;
    }

    const soloCaracteristica =
      !!filtros.caracteristica &&
      !ai.entities?.categoria &&
      !ai.entities?.subcategoria &&
      !ai.entities?.especialidad;

    if (soloCaracteristica) {
      filtros.categoriaId = undefined;
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

    this.normalizarIntentSalud(ai, filtros);

    return filtros;
  }

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

  private ordenarResultadosPorPreferencias(resultados: any, prefs: any[] | null) {
    if (!prefs || !Array.isArray(resultados?.items) || resultados.items.length === 0) {
      return resultados;
    }

    resultados.items = resultados.items.map((item) => {
      const coincideCat = prefs.some((p) => p.categoriaId === item.categoria_id);
      const coincideSub = prefs.some(
        (p) => p.subcategoriaId === item.subcategoria_id,
      );

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
      const ai = await this.jelpyAiService.interpretar({
        text: texto,
        city_hint: ciudadManual ?? null,
        lat: latitud ?? null,
        lng: longitud ?? null,
        user_id: usuarioId ?? null,
      });

      filtros = await this.mapearFastApiAFiltros(ai, ciudadManual, texto);

      this.aplicarCoordenadasSiCorresponde(filtros, latitud, longitud);

      prefs = await this.aplicarPreferenciasUsuario(filtros, usuarioId);

      const queryBusqueda = this.resolveQueryForSearch(filtros, textoNorm);

      let resultados: any = await this.searchService.search({
        q: queryBusqueda,
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

      if (!this.hasResults(resultados) && !filtros.caracteristica) {
        const resultadosItems = await this.searchService.searchByItems({
          q: queryBusqueda,
          ciudad: filtros.ciudad,
          caracteristica: filtros.caracteristica,
          lat: filtros.lat,
          lng: filtros.lng,
          radioKm: 10,
        });

        if (this.hasResults(resultadosItems)) {
          resultados = resultadosItems;
          filtros.intent = 'buscar_items_negocio';
        }
      }

      if (
        !this.hasResults(resultados) &&
        filtros.subcategoriaId &&
        filtros.categoriaId
      ) {
        const resultadosFallbackCat = await this.searchService.search({
          q: queryBusqueda,
          ciudad: filtros.ciudad,
          categoriaId: filtros.categoriaId,
          caracteristica: filtros.caracteristica,
          abiertoAhora: filtros.abiertoAhora ?? false,
          promos: filtros.promos ?? false,
          radioKm: 10,
        });

        if (this.hasResults(resultadosFallbackCat)) {
          resultados = resultadosFallbackCat;
          filtros.esFallback = true;
          filtros.fallbackReason = 'sin_subcategoria';
        }
      }

      resultados = this.ordenarResultadosPorPreferencias(resultados, prefs);

      if (!this.hasResults(resultados)) {
        resultados = await this.searchService.search({
          q: queryBusqueda,
          ciudad: filtros.ciudad,
          categoriaId: filtros.categoriaId,
          subcategoriaId: filtros.subcategoriaId,
          especialidadId: filtros.especialidadId,
          caracteristica: filtros.caracteristica,
          abiertoAhora: filtros.abiertoAhora ?? false,
          promos: filtros.promos ?? false,
          radioKm: 10,
        });

        if (!this.hasResults(resultados) && !filtros.caracteristica) {
          const resultadosItems = await this.searchService.searchByItems({
            q: queryBusqueda,
            ciudad: filtros.ciudad,
            caracteristica: filtros.caracteristica,
            lat: filtros.lat,
            lng: filtros.lng,
            radioKm: 10,
          });

          if (this.hasResults(resultadosItems)) {
            resultados = resultadosItems;
            filtros.intent = 'buscar_items_negocio';
          }
        }
      }

      if (!this.hasResults(resultados)) {
        const resultadosNombre = await this.searchService.search({
          q: filtros.caracteristica ? queryBusqueda : texto,
          ciudad: filtros.ciudad,
          caracteristica: filtros.caracteristica,
          radioKm: 10,
        });

        if (this.hasResults(resultadosNombre)) {
          resultados = resultadosNombre;
          filtros.esFallback = true;
          filtros.fallbackReason = 'por_nombre_negocio';
        }
      }

      resultados = this.normalizarPromosEnResultados(resultados);

      if (this.hasResults(resultados)) {
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

    const caracteristicaBD = await this.detectarCaracteristicaDesdeBD(texto);

    if (caracteristicaBD) {
      filtros.caracteristica = caracteristicaBD.nombre;

      const qSinCaracteristica = this.limpiarTextoSinCaracteristica(
        texto,
        caracteristicaBD,
      );

      if (qSinCaracteristica) {
        filtros.q = qSinCaracteristica;
      }
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

      if (lista.length > 0) {
        keywordsEncontrados.push(...lista);
      }
    }

    let keywordElegida: KeywordTaxonomia | null = null;

    if (keywordsEncontrados.length > 0) {
      keywordElegida = keywordsEncontrados.sort(
        (a, b) => b.relevancia - a.relevancia,
      )[0];

      filtros.q = filtros.q || keywordElegida.keyword;

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

    const queryBusqueda = this.resolveQueryForSearch(filtros, textoNorm);

    let resultados: any = await this.searchService.search({
      q: queryBusqueda,
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

    if (!this.hasResults(resultados) && !filtros.caracteristica) {
      const resultadosItems = await this.searchService.searchByItems({
        q: queryBusqueda,
        ciudad: filtros.ciudad,
        caracteristica: filtros.caracteristica,
        lat: filtros.lat,
        lng: filtros.lng,
        radioKm: 10,
      });

      if (this.hasResults(resultadosItems)) {
        resultados = resultadosItems;
        filtros.intent = 'buscar_items_negocio';
      }
    }

    resultados = this.ordenarResultadosPorPreferencias(resultados, prefs);

    if (!this.hasResults(resultados)) {
      resultados = await this.searchService.search({
        q: queryBusqueda,
        ciudad: filtros.ciudad,
        categoriaId: filtros.categoriaId,
        subcategoriaId: filtros.subcategoriaId,
        especialidadId: filtros.especialidadId,
        caracteristica: filtros.caracteristica,
        abiertoAhora: filtros.abiertoAhora ?? false,
        promos: filtros.promos ?? false,
        radioKm: 10,
      });

      if (!this.hasResults(resultados) && !filtros.caracteristica) {
        const resultadosItems = await this.searchService.searchByItems({
          q: queryBusqueda,
          ciudad: filtros.ciudad,
          caracteristica: filtros.caracteristica,
          lat: filtros.lat,
          lng: filtros.lng,
          radioKm: 10,
        });

        if (this.hasResults(resultadosItems)) {
          resultados = resultadosItems;
          filtros.intent = 'buscar_items_negocio';
        }
      }
    }

    resultados = this.normalizarPromosEnResultados(resultados);

    if (!keywordElegida && this.hasResults(resultados)) {
      await this.aprenderKeyword(textoNorm, resultados);
    }

    if (keywordElegida && this.hasResults(resultados)) {
      await this.reforzarKeyword(textoNorm, keywordElegida);
    }

    return {
      filtros_detectados: filtros,
      resultados,
    };
  }
}