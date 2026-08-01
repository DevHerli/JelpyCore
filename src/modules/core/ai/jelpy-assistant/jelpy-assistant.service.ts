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
  aliases: string[];
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

    if (!nombreNorm) return null;

    // 1. Exacto: "comida" === "comida"
    for (const c of categorias) {
      if (this.normalizar(c.nombre) === nombreNorm) return c;
    }

    // 2. La categoría en DB contiene la palabra de FastAPI: "comida y bebida".includes("comida") ✓
    for (const c of categorias) {
      const catNorm = this.normalizar(c.nombre);
      if (catNorm.includes(nombreNorm)) return c;
    }

    // 3. La palabra de FastAPI contiene el nombre de la categoría (cuando FastAPI es más verboso)
    for (const c of categorias) {
      const catNorm = this.normalizar(c.nombre);
      if (catNorm.length >= 4 && nombreNorm.includes(catNorm)) return c;
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

    const aliasesPorCaracteristica = new Map<number, string[]>();

for (const a of aliases) {
  const caracteristicaId = Number(a.caracteristicaId);

  if (!aliasesPorCaracteristica.has(caracteristicaId)) {
    aliasesPorCaracteristica.set(caracteristicaId, []);
  }

  aliasesPorCaracteristica.get(caracteristicaId)!.push(a.alias);
}

    const candidatos: CaracteristicaDetectada[] = [];

    for (const c of caracteristicas) {
      candidatos.push({
        id: Number(c.id),
        nombre: c.nombre,
        codigo: c.codigo,
        aliasDetectado: c.nombre,
        aliasNormalizado: this.normalizar(c.nombre),
        aliases: aliasesPorCaracteristica.get(Number(c.id)) ?? [],
      });

      candidatos.push({
        id: Number(c.id),
        nombre: c.nombre,
        codigo: c.codigo,
        aliasDetectado: c.codigo,
        aliasNormalizado: this.normalizar(c.codigo),
        aliases: aliasesPorCaracteristica.get(Number(c.id)) ?? [],
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
  aliases: aliasesPorCaracteristica.get(Number(caracteristica.id)) ?? [],
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

    // --- Característica: FastAPI como fuente principal, BD como fallback ---
    const fdCaracteristica: string | null =
      ai.filtros_detectados?.caracteristica ?? null;
    const fdCaracteristicaNombre: string | null =
      ai.filtros_detectados?.caracteristicaNombre ?? null;
    const fdCaracteristicas: string[] =
      ai.filtros_detectados?.caracteristicas ?? [];

    if (fdCaracteristica) {
      // Usar el nombre legible para que SearchService haga LIKE en cf.nombre
      filtros.caracteristica = fdCaracteristicaNombre ?? fdCaracteristica;
      if (fdCaracteristicas.length > 0) {
        filtros.caracteristicas = fdCaracteristicas;
      }

      // Limpiar la q del texto de la característica
      const qLimpia = this.limpiarTextoSinCaracteristica(
        textoOriginal || ai.normalized_text || '',
        {
          id: 0,
          nombre: fdCaracteristicaNombre ?? '',
          codigo: fdCaracteristica,
          aliasDetectado: '',
          aliasNormalizado: '',
          aliases: [],
        },
      );
      if (qLimpia) filtros.q = qLimpia;
    } else {
      // Fallback: detección local contra la BD de aliases
      const caracteristicaBD = await this.detectarCaracteristicaDesdeBD(
        textoOriginal || ai.normalized_text || '',
      );

      if (caracteristicaBD) {
        filtros.caracteristica = caracteristicaBD.nombre;
        filtros.caracteristicaAliases = caracteristicaBD.aliases ?? [];

        const qSinCaracteristica = this.limpiarTextoSinCaracteristica(
          textoOriginal || ai.normalized_text || '',
          caracteristicaBD,
        );

        filtros.q = qSinCaracteristica || undefined;
      }
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

  // -----------------------------------------------------------------------
  // SUGERENCIAS DE SEGUIMIENTO — contextuales, no repetitivas
  // -----------------------------------------------------------------------
  /**
   * Regla principal:
   *   - Búsqueda GENERAL (solo categoría, sin subcategoría/especialidad):
   *       → solo refinadores universales: abierto ahora, domicilio, promos,
   *         estacionamiento. NUNCA características específicas de un giro.
   *   - Búsqueda ESPECÍFICA (subcategoría / especialidad / keyword concreto):
   *       → primero características reales de los negocios encontrados
   *         (extraídas de sucursales_caracteristicas), luego refinadores generales.
   *
   * En ambos casos: nunca repite algo que ya esté en filtersApplied.
   */
  private async generarSugerencias(
    resultados: any,
    filtros: any,
    filtersApplied: string[] = [],
  ): Promise<Array<{ label: string; query: string; filter: string }>> {
    const sugerencias: Array<{ label: string; query: string; filter: string }> = [];
    const yaAplicados = new Set<string>(filtersApplied);

    // Marcar filtros activos en esta búsqueda
    if (filtros.abiertoAhora)   yaAplicados.add('abierto_ahora');
    if (filtros.promos)         yaAplicados.add('con_promos');
    if (filtros.caracteristica) {
      yaAplicados.add(this.normalizar(filtros.caracteristica).replace(/\s+/g, '_'));
    }

    // ── Determinar si la búsqueda es específica o general ─────────────────
    // Específica = el usuario ya mencionó una subcategoría, especialidad
    // o una keyword concreta (no solo el nombre genérico de una categoría).
    const esEspecifica =
      !!filtros.subcategoriaId ||
      !!filtros.especialidadId ||
      (!!filtros.q && !this.esTerminoGenerico(filtros.q));

    // ── Características reales (solo para búsquedas específicas) ──────────
    if (esEspecifica) {
      const sucursalIds: number[] = (resultados?.items ?? [])
        .map((i: any) => Number(i.sucursal_id ?? i.id))
        .filter((id: number) => id > 0 && !Number.isNaN(id));

      if (sucursalIds.length > 0) {
        try {
          const placeholders = sucursalIds.map(() => '?').join(',');
          const rows: any[] = await this.caracteristicaRepo.manager.query(
            `SELECT cs.codigo, cs.nombre, COUNT(*) AS total
             FROM sucursales_caracteristicas sc
             INNER JOIN caracteristicas_sucursal cs ON cs.id = sc.caracteristica_id
             WHERE sc.sucursal_id IN (${placeholders})
               AND sc.valor  = 1
               AND cs.activo = 1
             GROUP BY cs.id, cs.codigo, cs.nombre
             ORDER BY total DESC
             LIMIT 10`,
            sucursalIds,
          );

          for (const row of rows) {
            if (sugerencias.length >= 2) break;
            const filterKey: string   = row.codigo;
            const nombreNorm: string  = this.normalizar(row.nombre).replace(/\s+/g, '_');
            if (yaAplicados.has(filterKey) || yaAplicados.has(nombreNorm)) continue;
            const prefijo = Number(row.total) === 1 ? 'el que tiene' : 'los que tienen';
            sugerencias.push({
              label:  `¿Solo ${prefijo} ${row.nombre.toLowerCase()}?`,
              query:  `con ${row.nombre.toLowerCase()}`,
              filter: filterKey,
            });
            yaAplicados.add(filterKey);
          }
        } catch {
          // Si la query falla, rellena con generales
        }
      }
    }

    // ── Refinadores universales (aplican para CUALQUIER giro) ─────────────
    // Se muestran siempre que haya espacio y no se hayan aplicado ya.
    const universales: Array<{ label: string; query: string; filter: string }> = [
      {
        label:  '¿Solo los que están abiertos ahora?',
        query:  'abierto ahora',
        filter: 'abierto_ahora',
      },
      {
        label:  '¿Solo los que tienen servicio a domicilio?',
        query:  'con servicio a domicilio',
        filter: 'servicio_domicilio',
      },
      {
        label:  '¿Quieres ver los que tienen promociones?',
        query:  'con promociones',
        filter: 'con_promos',
      },
      {
        label:  '¿Los prefieres con estacionamiento?',
        query:  'con estacionamiento',
        filter: 'estacionamiento',
      },
    ];

    for (const u of universales) {
      if (sugerencias.length >= 3) break;
      if (!yaAplicados.has(u.filter)) {
        sugerencias.push(u);
        yaAplicados.add(u.filter);
      }
    }

    return sugerencias.slice(0, 3);
  }

  /**
   * Devuelve true si el término es demasiado genérico para considerarse
   * una búsqueda específica (y así evitar sugerencias de giro particular).
   */
  private esTerminoGenerico(q: string): boolean {
    const GENERICOS = [
      'restaurante', 'restaurantes', 'comida', 'negocio', 'negocios',
      'tienda', 'tiendas', 'servicio', 'servicios', 'salud', 'belleza',
      'entretenimiento', 'mascotas', 'turismo', 'educacion', 'hogar',
      'automotriz', 'deporte', 'bar', 'bares', 'cafe', 'cafes',
      'cerca', 'cercano', 'cercanos', 'lugar', 'lugares',
    ];
    const norm = this.normalizar(q ?? '');
    return !norm || GENERICOS.some((g) => norm === g || norm.includes(g));
  }

  /**
   * Detecta si el texto viene de un chip de sugerencia (es una pregunta
   * meta-conversacional del bot, no una intención de búsqueda real).
   * Ej: "¿Quieres intentar con otra palabra?" → true
   *     "¿Buscas mariscos con domicilio?"    → false (es búsqueda real)
   */
  private esMetaPregunta(texto: string): boolean {
    const norm = this.normalizar(texto);
    const META = [
      'quieres intentar con otra palabra',
      'buscas algo diferente',
      'quieres ampliar la busqueda',
      'intentar de nuevo',
      'buscar en otra categoria',
      'quieres ver mas opciones',
      'ampliar la busqueda',
      'cambiar de busqueda',
    ];
    return META.some((m) => norm.includes(m));
  }

  /**
   * Limpia el texto si viene como label de chip (quita ¿? y connectors iniciales).
   * "¿Buscas mariscos con servicio a domicilio?" → "mariscos con servicio a domicilio"
   */
  private limpiarTextoChip(texto: string): string {
    return texto
      .replace(/^[¿¡\s]+/, '')
      .replace(/[?!\s]+$/, '')
      .replace(/^(buscas|busca|quieres|solo los que|los que tienen|ver)\s+/i, '')
      .trim();
  }

  /**
   * Genera sugerencias de ampliación cuando no hay resultados.
   * En vez de chips meta ("¿intentar con otra palabra?") devuelve
   * búsquedas concretas más amplias para salir del ciclo.
   */
  private generarSugerenciasSinResultados(
    filtros: any,
    ciudad: string | undefined,
    filtersApplied: string[],
  ): Array<{ label: string; query: string; filter: string }> {
    const sugerencias: Array<{ label: string; query: string; filter: string }> = [];
    const yaAplicados = new Set<string>(filtersApplied);
    const ciudadLabel = ciudad ? ` en ${ciudad}` : '';

    // Si tenía características aplicadas → quitar filtros y buscar solo la entidad
    const entidad = filtros.q || filtros.normalizedText || '';
    const entidadLimpia = entidad
      .replace(/con\s+(servicio a domicilio|domicilio|estacionamiento|wifi|promociones)/gi, '')
      .trim();

    if (entidadLimpia && !yaAplicados.has('sin_filtros')) {
      sugerencias.push({
        label:  `Ver todos los ${entidadLimpia.toLowerCase()}${ciudadLabel}`,
        query:  entidadLimpia,
        filter: 'sin_filtros',
      });
    }

    // Sugerir ampliar a la categoría padre
    if (filtros.subcategoriaId || filtros.especialidadId) {
      if (!yaAplicados.has('ampliar_categoria')) {
        sugerencias.push({
          label:  `Buscar en toda la categoría${ciudadLabel}`,
          query:  filtros.q?.split(' ')[0] ?? 'negocios',
          filter: 'ampliar_categoria',
        });
      }
    }

    // Búsqueda completamente abierta
    if (sugerencias.length < 2 && !yaAplicados.has('busqueda_abierta')) {
      sugerencias.push({
        label:  `¿Qué más puedo buscar para ti${ciudadLabel}?`,
        query:  '',
        filter: 'busqueda_abierta',
      });
    }

    return sugerencias.slice(0, 2);
  }

  async interpretar(
    texto: string,
    latitud?: number,
    longitud?: number,
    ciudadManual?: string,
    usuarioId?: number,
    filtersApplied: string[] = [],
  ) {
    let filtros: any = {};
    let prefs: any[] | null = null;

    // ── Detección anti-ciclo ───────────────────────────────────────────────
    // Si el mensaje es una meta-pregunta del propio bot (chip sin resultados),
    // responder con mensaje de orientación en vez de buscar sin sentido.
    if (this.esMetaPregunta(texto)) {
      return {
        filtros_detectados: {},
        resultados: { items: [] },
        sin_resultados: true,
        mensaje_sin_resultados:
          '¿Qué estás buscando? Cuéntame y te ayudo a encontrarlo 😊',
        suggestedQueries: [],
        esMensajeOrientacion: true,
      };
    }

    // Si el texto viene de un chip (empieza con ¿ y termina con ?),
    // limpiar los signos para extraer mejor el intent.
    const textoProcesado =
      texto.startsWith('¿') && texto.endsWith('?')
        ? this.limpiarTextoChip(texto)
        : texto;

    const textoNorm = this.normalizar(textoProcesado);

    try {
      const ai = await this.jelpyAiService.interpretar({
        text: textoProcesado,
        city_hint: ciudadManual ?? null,
        lat: latitud ?? null,
        lng: longitud ?? null,
        user_id: usuarioId ?? null,
      });

      filtros = await this.mapearFastApiAFiltros(ai, ciudadManual, textoProcesado);

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
          categoriaId: filtros.categoriaId,
          subcategoriaId: filtros.subcategoriaId,
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
            categoriaId: filtros.categoriaId,
            subcategoriaId: filtros.subcategoriaId,
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

      // Fallback final: solo buscar por nombre de negocio (sin categoría) cuando
      // FastAPI NO detectó una categoría específica. Si detectó "comida" y no hay
      // negocios de comida, es preferible devolver sin resultados que mostrar un hospital.
      const tieneCategoriaClaraDeIA =
        !!filtros.categoriaId || !!filtros.subcategoriaId || !!filtros.especialidadId;

      if (!this.hasResults(resultados) && !tieneCategoriaClaraDeIA) {
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

      // Log para debug: qué devuelve FastAPI y qué filtros se construyeron
      console.log(`[JelpyAssistant] texto="${texto}" → categoriaId=${filtros.categoriaId} subcategoriaId=${filtros.subcategoriaId} q="${filtros.q}" intent=${filtros.intent} resultados=${resultados?.items?.length ?? 0}`);

      const sinResultados = !this.hasResults(resultados);

      const suggestedQueries = sinResultados
        ? this.generarSugerenciasSinResultados(filtros, filtros.ciudad, filtersApplied)
        : await this.generarSugerencias(resultados, filtros, filtersApplied);

      return {
        filtros_detectados: filtros,
        resultados,
        sin_resultados: sinResultados,
        mensaje_sin_resultados: sinResultados
          ? `No encontré negocios en tu zona con esa búsqueda. Prueba alguna de estas opciones:`
          : null,
        suggestedQueries,
      };
    } catch (error) {
      console.warn(
        'FastAPI no respondió correctamente, usando fallback local.',
        error?.message || error,
      );

      return this.interpretarFallbackLocal(
        textoProcesado,
        latitud,
        longitud,
        ciudadManual,
        usuarioId,
        filtersApplied,
      );
    }
  }

  private async interpretarFallbackLocal(
    texto: string,
    latitud?: number,
    longitud?: number,
    ciudadManual?: string,
    usuarioId?: number,
    filtersApplied: string[] = [],
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
      filtros.caracteristicaAliases = caracteristicaBD.aliases ?? [];

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
        categoriaId: filtros.categoriaId,
        subcategoriaId: filtros.subcategoriaId,
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
          categoriaId: filtros.categoriaId,
          subcategoriaId: filtros.subcategoriaId,
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

    const sinResultados = !this.hasResults(resultados);

    const suggestedQueries = sinResultados
      ? this.generarSugerenciasSinResultados(filtros, filtros.ciudad, filtersApplied)
      : await this.generarSugerencias(resultados, filtros, filtersApplied);

    return {
      filtros_detectados: filtros,
      resultados,
      sin_resultados: sinResultados,
      mensaje_sin_resultados: sinResultados
        ? `No encontré negocios en tu zona con esa búsqueda. Prueba alguna de estas opciones:`
        : null,
      suggestedQueries,
    };
  }
}