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
import { ChatResponses } from '../utils/chat-responses';
import { ConversationClassifier } from '../utils/conversation-classifier';
import { levenshtein } from '../utils/levenshtein.util';
import { coincideTerminoDeNegocio } from '../utils/business-term-matcher.util';

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
    'a', 'y', 'o', 'para', 'por', 'con', 'sin', 'que', 'mi', 'mí', 'me', 'donde', 'hay', 'busca',
    'buscas', 'buscar', 'quiero', 'quieres', 'quieras', 'necesito',
    'dime', 'lugar', 'lugares', 'negocio', 'negocios',
    'esta', 'está', 'estan', 'están', 'mas', 'más',
    'vende', 'venden', 'vendan', 'vender', 'venta', 'encuentro', 'encontrar',
    'consigo', 'comprar', 'compra', 'quien', 'quién', 'hace', 'hacen', 'hacer',
    'ofrece', 'ofrecen', 'ofrecer', 'tiene', 'tienen', 'tenga', 'tengan',
    'cuenta', 'cuentan', 'realiza', 'realizan',
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

  private normalizarParaCoincidencia(texto: string): string {
    return this.normalizar(texto)
      .replace(/[¿?¡!.,;:()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private contieneTerminoDeNegocio(texto: string): boolean {
    const textoNorm = this.normalizarParaCoincidencia(texto);

    return this.diccionarioSemantico.some((cat) =>
      cat.aliases.some((alias) =>
        coincideTerminoDeNegocio(textoNorm, this.normalizarParaCoincidencia(alias)),
      ),
    );
  }

  private responderConversacional(texto: string, ciudad?: string | null) {
    const clasificacion = ConversationClassifier.classify(texto);
    const intent = clasificacion.chatIntent;

    if (clasificacion.route === 'search') return null;

    const respuesta = ChatResponses.responder(texto, {
      ciudad: ciudad ?? undefined,
      historialTurnos: 0,
    });
    const respuestaConCierre = {
      ...respuesta,
      mensaje: ChatResponses.agregarCierreGenerico(respuesta.mensaje),
    };
    const suggestedQueries: Array<{ label: string; query: string; filter: string }> = [];

    return {
      filtros_detectados: {
        intent: 'chat',
        chatIntent: intent,
        clasificacion: clasificacion.intent,
        ciudad: ciudad ?? null,
      },
      resultados: { items: [] },
      sin_resultados: false,
      mensaje_sin_resultados: null,
      esMensajeConversacional: true,
      respuesta: respuestaConCierre,
      titulo: respuestaConCierre.titulo,
      mensaje: respuestaConCierre.mensaje,
      suggestedQueries,
    };
  }

  /**
   * JLP-ESPECIALIDAD-BUSQUEDA-FIX: bug reportado por el usuario — pidió
   * "trauma"/"traumatologo"/"traumatologia" y Jelpy respondió "no encontré
   * resultados" pese a existir un doctor con especialidad Traumatología
   * dado de alta. Causa raíz: los `servicios` de cada entrada (nombres de
   * especialidad/servicio, ej. "Traumatología", "traumatologo") SOLO se
   * revisaban cuando algún ALIAS de esa misma entrada ("doctor", "medico",
   * etc.) también aparecía en el texto — si el usuario solo escribía el
   * nombre de la especialidad, sin decir "doctor"/"médico" a su lado, el
   * servicio nunca se detectaba y `giroDetectado` quedaba vacío. Ahora los
   * servicios se revisan de forma independiente: basta con mencionar la
   * especialidad para reconocer el giro (Salud → Doctores) y arrastrar el
   * nombre real de la especialidad a `serviciosDetectados`.
   */
  private detectarIntencionSemantica(textoNorm: string): SemanticDetectionResult {
    const serviciosDetectados = new Set<string>();
    const aliasesDetectados = new Set<string>();
    let giroDetectado: string | undefined;

    // JLP-CONECTOR-OPCIONAL-FIX: se usa el mismo helper que
    // `ConversationClassifier`/`AiService` (en vez de `textoNorm.includes(...)`
    // sobre la frase literal) para que alias/servicios de varias palabras
    // con conectores gramaticales ("corte DE pelo", "salón DE belleza")
    // también coincidan cuando el usuario los omite ("corte pelo", "salon
    // belleza") — ver el comentario de `business-term-matcher.util.ts` para
    // el bug exacto que esto corrige.
    for (const entrada of this.diccionarioSemantico) {
      const coincidencias = entrada.aliases.filter((alias) =>
        coincideTerminoDeNegocio(textoNorm, this.normalizar(alias)),
      );

      const serviciosCoincidentes = entrada.servicios.filter((servicio) =>
        coincideTerminoDeNegocio(textoNorm, this.normalizar(servicio)),
      );

      if (coincidencias.length > 0 || serviciosCoincidentes.length > 0) {
        giroDetectado = giroDetectado || entrada.clave;

        coincidencias.forEach((alias) => aliasesDetectados.add(alias));
        serviciosCoincidentes.forEach((servicio) => serviciosDetectados.add(servicio));
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

  /**
   * JLP-ESPECIALIDAD-BUSQUEDA-FIX: bug reportado por el usuario — buscar
   * "trauma"/"traumatologo"/"traumatologia" devolvía "no encontré
   * resultados" pese a existir un doctor con especialidad Traumatología
   * dado de alta. Causa raíz: este método SOLO aceptaba coincidencia
   * EXACTA contra el nombre de la especialidad en BD ("Traumatología"),
   * a diferencia de `buscarCategoriaPorNombre`/`buscarSubcategoriaPorNombre`
   * (arriba), que ya toleran coincidencia parcial en cualquier dirección.
   * Con exact-match a secas:
   *   - "trauma" (raíz coloquial) nunca es igual a "traumatologia" → falla.
   *   - "traumatologo" (la forma que la gente realmente escribe) tampoco es
   *     igual a "traumatologia" (mismo origen, terminación distinta:
   *     -logo/-óloga vs. -logía) → falla también.
   * Se agregan, en orden, los mismos niveles de tolerancia que ya usan
   * categoría/subcategoría (substring en cualquier dirección) más dos
   * niveles adicionales pensados para nombres de especialidad médica:
   * raíz compartida (cubre -logo/-óloga/-logía) y distancia de Levenshtein
   * pequeña (cubre errores de dedo/ortografía).
   */
  private async buscarEspecialidadPorNombre(nombre: string): Promise<Especialidad | null> {
    const especialidades = await this.especialidadRepo.find({
      relations: ['subcategoria'],
    });

    const nombreNorm = this.normalizar(nombre);

    if (!nombreNorm) return null;

    // 1. Exacto: "traumatologia" === "traumatologia"
    for (const especialidad of especialidades) {
      if (this.normalizar(especialidad.nombre) === nombreNorm) {
        return especialidad;
      }
    }

    // 2. Substring en cualquier dirección: "trauma" está contenido en
    //    "traumatologia" (raíz corta/coloquial), o al revés si el usuario
    //    escribe algo más largo que el nombre exacto de la especialidad.
    for (const especialidad of especialidades) {
      const espNorm = this.normalizar(especialidad.nombre);

      if (
        espNorm.length >= 4 &&
        nombreNorm.length >= 4 &&
        (espNorm.includes(nombreNorm) || nombreNorm.includes(espNorm))
      ) {
        return especialidad;
      }
    }

    // 3. Raíz compartida (mínimo 6 caracteres): cubre variantes como
    //    "traumatologo"/"traumatóloga" vs. "Traumatología" en BD, que NO
    //    son substring una de la otra porque solo cambia la terminación
    //    (-logo/-óloga vs. -logía).
    const RAIZ_MINIMA = 6;
    let mejorPorRaiz: { especialidad: Especialidad; raiz: number } | null = null;

    for (const especialidad of especialidades) {
      const espNorm = this.normalizar(especialidad.nombre);
      const raiz = this.prefijoComun(espNorm, nombreNorm);

      if (raiz >= RAIZ_MINIMA && (!mejorPorRaiz || raiz > mejorPorRaiz.raiz)) {
        mejorPorRaiz = { especialidad, raiz };
      }
    }

    if (mejorPorRaiz) return mejorPorRaiz.especialidad;

    // 4. Tolerancia a errores tipográficos: distancia de Levenshtein
    //    pequeña entre palabras de longitud comparable.
    for (const especialidad of especialidades) {
      const espNorm = this.normalizar(especialidad.nombre);

      if (espNorm.length < 5 || nombreNorm.length < 5) continue;
      if (Math.abs(espNorm.length - nombreNorm.length) > 3) continue;

      if (levenshtein(espNorm, nombreNorm) <= 2) {
        return especialidad;
      }
    }

    return null;
  }

  /** Longitud del prefijo común (mismos caracteres desde el inicio) entre dos cadenas. */
  private prefijoComun(a: string, b: string): number {
    const len = Math.min(a.length, b.length);
    let i = 0;

    while (i < len && a[i] === b[i]) i++;

    return i;
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
      textoNorm.includes('trauma') ||
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

    if (filtros.q) return filtros.q;

    const limpio = this.normalizar(textoNorm)
      .replace(/[¿?¡!.,;:()]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !this.stopwords.includes(token))
      .join(' ')
      .trim();

    return limpio || textoNorm;
  }

  private esConsultaDeCatalogo(textoNorm: string, filtros: any): boolean {
    if (filtros.intent === 'buscar_items_negocio') return true;

    const patrones = [
      'donde venden',
      'donde vende',
      'donde encuentro',
      'donde consigo',
      'donde comprar',
      'quien vende',
      'quien tiene',
      'quien hace',
      'donde hacen',
      'donde hace',
      'donde realizan',
      'donde realiza',
      'donde ofrecen',
      'donde ofrece',
      'que negocios venden',
      'que negocio vende',
      'que lugares venden',
      'que lugar vende',
      'tienen',
      'cuentan con',
      'hacen',
    ];

    return patrones.some((patron) => textoNorm.includes(this.normalizar(patron)));
  }

  private limpiarQueryCatalogo(textoNorm: string): string {
    return this.normalizar(textoNorm)
      .replace(/[¿?¡!.,;:()]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !this.stopwords.includes(token))
      .join(' ')
      .trim();
  }

  private async buscarEnCatalogo(params: {
    queryBusqueda?: string;
    filtros: any;
    latitud?: number;
    longitud?: number;
    permitirFiltrosTaxonomia?: boolean;
  }) {
    const {
      queryBusqueda,
      filtros,
      latitud,
      longitud,
      permitirFiltrosTaxonomia = true,
    } = params;

    if (!queryBusqueda) return { items: [] };

    const base = {
      q: queryBusqueda,
      ciudad: filtros.ciudad,
      caracteristica: filtros.caracteristica,
      lat: filtros.lat ?? latitud,
      lng: filtros.lng ?? longitud,
      radioKm: 10,
    };

    const resultadosConTaxonomia = await this.searchService.searchByItems({
      ...base,
      categoriaId: permitirFiltrosTaxonomia ? filtros.categoriaId : undefined,
      subcategoriaId: permitirFiltrosTaxonomia ? filtros.subcategoriaId : undefined,
    });

    if (this.hasResults(resultadosConTaxonomia) || !permitirFiltrosTaxonomia) {
      return resultadosConTaxonomia;
    }

    return this.searchService.searchByItems(base);
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

    // JLP-ESPECIALIDAD-BUSQUEDA-FIX: bug reportado por el usuario — pidió
    // "trauma"/"traumatologo"/"traumatologia" y Jelpy respondió "no
    // encontré resultados" pese a existir un doctor con especialidad
    // Traumatología dado de alta. Causa raíz: nuestro diccionario
    // semántico local (`detectarIntencionSemantica`, con los `servicios`
    // de cada categoría — nombres de especialidad y sus formas
    // coloquiales) SOLO se consultaba en `interpretarFallbackLocal`, es
    // decir, únicamente cuando FastAPI truena por completo. Si FastAPI
    // respondía 200 pero no reconocía la especialidad como entidad (algo
    // muy probable con términos cortos/coloquiales que un NLP genérico no
    // tiene por qué conocer), esta señal local nunca se usaba como
    // complemento y la búsqueda quedaba sin categoría/subcategoría/
    // especialidad, cayendo a una búsqueda de texto libre que tampoco
    // encuentra "traumatologo" dentro de "Traumatología" (no es substring
    // exacto: la terminación -logo/-óloga es distinta de -logía).
    //
    // Se agrega aquí como COMPLEMENTO — solo rellena lo que FastAPI dejó
    // vacío, nunca sobreescribe lo que FastAPI ya detectó.
    //
    // `especialidadResueltaLocal`/`categoriaResueltaLocal` se usan más abajo
    // para corregir `filtros.q`: si dejáramos el texto crudo del usuario
    // ("traumatologo") como filtro de texto libre, la búsqueda seguiría
    // fallando aunque `especialidadId` ya apunte al registro correcto,
    // porque el buscador aplica el texto como filtro ADICIONAL (AND) y
    // "traumatologo" no es substring literal de "Traumatología" en BD.
    let especialidadResueltaLocal: Especialidad | null = null;
    let subcategoriaResueltaLocal: Subcategoria | null = null;
    let categoriaResueltaLocal: Categoria | null = null;

    if (!filtros.categoriaId || !filtros.subcategoriaId || !filtros.especialidadId) {
      const textoParaSemantica = this.normalizar(
        textoOriginal || ai.normalized_text || '',
      );
      const analisisSemantico = this.detectarIntencionSemantica(textoParaSemantica);

      if (!filtros.especialidadId) {
        for (const servicio of analisisSemantico.serviciosDetectados) {
          const especialidadLocal = await this.buscarEspecialidadPorNombre(servicio);

          if (especialidadLocal) {
            filtros.especialidadId = Number(especialidadLocal.id);
            especialidadResueltaLocal = especialidadLocal;

            if (!filtros.subcategoriaId && especialidadLocal.subcategoria?.id) {
              filtros.subcategoriaId = Number(especialidadLocal.subcategoria.id);
            }

            break;
          }
        }
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
            const subcategoriaLocal = await this.buscarSubcategoriaPorNombre(
              entradaSemantica.subcategoriaHint,
            );

            if (subcategoriaLocal) {
              filtros.subcategoriaId = Number(subcategoriaLocal.id);
              subcategoriaResueltaLocal = subcategoriaLocal;

              if (!filtros.categoriaId && subcategoriaLocal.categoria?.id) {
                filtros.categoriaId = Number(subcategoriaLocal.categoria.id);
              }
            }
          }

          if (!filtros.categoriaId && entradaSemantica.categoriaHint) {
            const categoriaLocal = await this.buscarCategoriaPorNombre(
              entradaSemantica.categoriaHint,
            );

            if (categoriaLocal) {
              filtros.categoriaId = Number(categoriaLocal.id);
              categoriaResueltaLocal = categoriaLocal;
            }
          }
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

    // JLP-ESPECIALIDAD-BUSQUEDA-FIX: si la especialidad/categoría se
    // resolvió por nuestro diccionario semántico local (arriba) y no por
    // FastAPI, `filtros.q` en este punto sigue siendo el texto CRUDO del
    // usuario ("traumatologo"). El buscador aplica ese texto como filtro
    // adicional (AND) junto con el ID ya resuelto, y "traumatologo" no es
    // substring literal de "Traumatología" en BD — así que dejarlo tal
    // cual anularía el match que ya conseguimos. Se reemplaza por el
    // nombre real de la especialidad/categoría (que sí matchea contra sí
    // mismo), igual que ya ocurre cuando es FastAPI quien detecta la
    // entidad.
    if (especialidadResueltaLocal) {
      filtros.q = especialidadResueltaLocal.nombre;
    } else if (subcategoriaResueltaLocal) {
      filtros.q = subcategoriaResueltaLocal.nombre;
    } else if (categoriaResueltaLocal) {
      filtros.q = categoriaResueltaLocal.nombre;
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
    if (process.env.JELPY_ENABLE_CHAT_CHIPS !== 'true') {
      return [];
    }

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
    if (process.env.JELPY_ENABLE_CHAT_CHIPS !== 'true') {
      return [];
    }

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
    const esPotencialConsultaCatalogo = this.esConsultaDeCatalogo(textoNorm, {});
    const respuestaConversacional = esPotencialConsultaCatalogo
      ? null
      : this.responderConversacional(
          textoProcesado,
          ciudadManual,
        );

    if (respuestaConversacional) {
      return respuestaConversacional;
    }

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
      const esConsultaCatalogo = this.esConsultaDeCatalogo(textoNorm, filtros);
      const queryCatalogo = esConsultaCatalogo
        ? this.limpiarQueryCatalogo(textoNorm)
        : queryBusqueda;

      if (esConsultaCatalogo) {
        const resultadosItems = await this.buscarEnCatalogo({
          queryBusqueda: queryCatalogo,
          filtros,
          latitud,
          longitud,
          permitirFiltrosTaxonomia: true,
        });

        const resultadosCatalogo = this.ordenarResultadosPorPreferencias(
          resultadosItems,
          prefs,
        );

        // JLP-CATALOGO-FALLBACK-FIX: bug reportado por el usuario — "sushi"
        // solo encontraba los restaurantes de sushi, pero "donde venden
        // sushi" (que activa `esConsultaCatalogo`) respondía "no entendí".
        // Causa raíz: sin match en `items_negocio` (el catálogo digital de
        // productos), esta rama devolvía "no encontré" de inmediato, sin
        // intentar la búsqueda normal por categoría/subcategoría de abajo.
        //
        // Pero OJO: no basta con caer siempre al flujo normal — eso fue
        // justo el bug que corrigió JLP-FALLBACK-CATEGORIA-CRUZADA-FIX (ver
        // el spec): "donde venden alitas" con solo `categoria=restaurantes`
        // (SIN subcategoría propia — "alitas" no es un giro de negocio, es
        // un platillo que cualquier tipo de restaurante podría vender) NO
        // debe caer a "buscar restaurantes en general", porque mostraría
        // negocios que ni siquiera venden alitas (categoría cruzada).
        //
        // La diferencia real: "sushi" SÍ tiene su propia subcategoría en la
        // taxonomía (Restaurantes > Sushi), así que TODOS los negocios de
        // esa subcategoría son relevantes — no hay riesgo de cruce. Se cae
        // al flujo normal de abajo SOLO cuando no hay resultados de catálogo
        // Y hay una subcategoría/especialidad PRECISA detectada (no solo una
        // categoría amplia como "restaurantes"/"tiendas"/"servicios"); en
        // cualquier otro caso (hay resultados, o no hay categoría precisa)
        // esta rama sigue siendo definitiva, igual que antes.
        const tieneCategoriaPrecisa = !!(filtros.subcategoriaId || filtros.especialidadId);

        if (this.hasResults(resultadosCatalogo) || !tieneCategoriaPrecisa) {
          filtros.intent = 'buscar_items_negocio';
          const sinResultadosCatalogo = !this.hasResults(resultadosCatalogo);

          return {
            filtros_detectados: filtros,
            resultados: this.normalizarPromosEnResultados(resultadosCatalogo),
            sin_resultados: sinResultadosCatalogo,
            mensaje_sin_resultados: sinResultadosCatalogo
              ? 'No encontré negocios con ese producto o servicio registrado en su catálogo.'
              : null,
            suggestedQueries: sinResultadosCatalogo
              ? this.generarSugerenciasSinResultados(filtros, filtros.ciudad, filtersApplied)
              : await this.generarSugerencias(resultadosCatalogo, filtros, filtersApplied),
          };
        }
      }

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

      // JLP-CATALOGO-FALLBACK-FIX: si `esConsultaCatalogo` ya era true arriba,
      // el catálogo de items ya se consultó (con la misma query, tras quitar
      // stopwords) y no tuvo coincidencias — evita repetir la misma consulta
      // al catálogo dos veces sin necesidad.
      if (!esConsultaCatalogo && !this.hasResults(resultados) && !filtros.caracteristica) {
        const resultadosItems = await this.buscarEnCatalogo({
          queryBusqueda,
          filtros,
          latitud,
          longitud,
          permitirFiltrosTaxonomia: true,
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
          const resultadosItems = await this.buscarEnCatalogo({
            queryBusqueda,
            filtros,
            latitud,
            longitud,
            permitirFiltrosTaxonomia: true,
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
      //
      // JLP-FALLBACK-CATEGORIA-CRUZADA-FIX: bug reportado por el usuario — pidió
      // "corte de pelo" y recibió resultados de farmacias. FastAPI SÍ detectó
      // correctamente categoria="belleza" / subcategoria="peluqueria", pero
      // `buscarCategoriaPorNombre`/`buscarSubcategoriaPorNombre` no lograron
      // mapear esos nombres a un ID real de la BD (ej. porque aún no hay ninguna
      // peluquería/barbería registrada en esa ciudad). Antes, esto dejaba
      // `filtros.categoriaId` vacío y `tieneCategoriaClaraDeIA` en `false`, lo que
      // abría la puerta al fallback de texto libre SIN ningún filtro de
      // categoría — una búsqueda `LIKE` contra toda la BD que puede coincidir por
      // accidente con un negocio de otro giro completamente distinto (una
      // farmacia que vende shampoo anticaída, por ejemplo). Ahora también se
      // considera "categoría clara" el solo hecho de que la IA haya detectado un
      // nombre de categoría/subcategoría/especialidad, aunque no se haya podido
      // resolver a un ID — en ese caso es preferible responder "no encontré" (con
      // sugerencias) que cruzar a un giro de negocio no relacionado.
      const tieneCategoriaClaraDeIA =
        !!filtros.categoriaId ||
        !!filtros.subcategoriaId ||
        !!filtros.especialidadId ||
        !!ai.entities?.categoria ||
        !!ai.entities?.subcategoria ||
        !!ai.entities?.especialidad;

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
    const esConsultaCatalogo = this.esConsultaDeCatalogo(textoNorm, filtros);
    const queryCatalogo = esConsultaCatalogo
      ? this.limpiarQueryCatalogo(textoNorm)
      : queryBusqueda;

    if (esConsultaCatalogo) {
      const resultadosItems = await this.buscarEnCatalogo({
        queryBusqueda: queryCatalogo,
        filtros,
        latitud,
        longitud,
        permitirFiltrosTaxonomia: true,
      });

      const resultadosCatalogo = this.normalizarPromosEnResultados(
        this.ordenarResultadosPorPreferencias(resultadosItems, prefs),
      );

      // JLP-CATALOGO-FALLBACK-FIX: ídem el otro punto de entrada arriba —
      // sin coincidencias en el catálogo digital de items, se deja caer al
      // flujo normal de búsqueda por categoría/subcategoría SOLO cuando hay
      // una subcategoría/especialidad precisa detectada (ej. "sushi"), para
      // no reintroducir el bug de categoría cruzada que corrigió
      // JLP-FALLBACK-CATEGORIA-CRUZADA-FIX (ej. "donde venden alitas" con
      // solo `categoria=restaurantes` no debe mostrar restaurantes al azar).
      const tieneCategoriaPrecisa = !!(filtros.subcategoriaId || filtros.especialidadId);

      if (this.hasResults(resultadosCatalogo) || !tieneCategoriaPrecisa) {
        filtros.intent = 'buscar_items_negocio';
        const sinResultadosCatalogo = !this.hasResults(resultadosCatalogo);

        return {
          filtros_detectados: filtros,
          resultados: resultadosCatalogo,
          sin_resultados: sinResultadosCatalogo,
          mensaje_sin_resultados: sinResultadosCatalogo
            ? 'No encontré negocios con ese producto o servicio registrado en su catálogo.'
            : null,
          suggestedQueries: sinResultadosCatalogo
            ? this.generarSugerenciasSinResultados(filtros, filtros.ciudad, filtersApplied)
            : await this.generarSugerencias(resultadosCatalogo, filtros, filtersApplied),
        };
      }
    }

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

    // JLP-CATALOGO-FALLBACK-FIX: ídem el otro punto de entrada — si
    // `esConsultaCatalogo` ya era true arriba, el catálogo de items ya se
    // consultó y no tuvo coincidencias, no repetir la misma consulta.
    if (!esConsultaCatalogo && !this.hasResults(resultados) && !filtros.caracteristica) {
      const resultadosItems = await this.buscarEnCatalogo({
        queryBusqueda,
        filtros,
        latitud,
        longitud,
        permitirFiltrosTaxonomia: true,
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
        const resultadosItems = await this.buscarEnCatalogo({
          queryBusqueda,
          filtros,
          latitud,
          longitud,
          permitirFiltrosTaxonomia: true,
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
