import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Negocio } from './entities/negocio.entity';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';

import { Suscriptor } from '../suscriptores/entities/suscriptores.entity';
import { KeywordTaxonomia } from '../../core/taxonomia/entities/keyword-taxonomia.entity';

import {
  ESTADOS_NEGOCIO,
  LIMITE_NEGOCIOS_POR_MEMBRESIA,
} from '../../../common/constants/negocios.constants';

@Injectable()
export class NegociosService {
  constructor(
    @InjectRepository(Negocio)
    private readonly negocioRepo: Repository<Negocio>,

    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,

    @InjectRepository(KeywordTaxonomia)
    private readonly keywordRepo: Repository<KeywordTaxonomia>,
  ) {}

  // ============================================================
  // NORMALIZADOR
  // ============================================================
  normalize(text: string) {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  // ============================================================
  // LISTAR
  // ============================================================
  async listar(): Promise<Negocio[]> {
    return this.negocioRepo.find({
      where: { eliminado: false },
      relations: [
        'suscriptor',
        'categoria',
        'subcategoria',
        'especialidad',
        'estado',
        'ciudad',
        'sucursales',
      ],
      order: { nombreNegocio: 'ASC' },
    });
  }

  // ============================================================
  // OBTENER POR ID
  // ============================================================
  async obtenerPorId(id: number): Promise<Negocio> {
    const negocio = await this.negocioRepo.findOne({
      where: { id, eliminado: false },
      relations: [
        'suscriptor',
        'categoria',
        'subcategoria',
        'especialidad',
        'estado',
        'ciudad',
        'sucursales',
      ],
    });

    if (!negocio) {
      throw new NotFoundException('Negocio no encontrado');
    }

    return negocio;
  }

  // ============================================================
  // LISTAR POR SUSCRIPTOR
  // ============================================================
  async listarPorSuscriptor(suscriptorId: number): Promise<Negocio[]> {
    return this.negocioRepo.find({
      where: { suscriptor: { id: suscriptorId }, eliminado: false },
      relations: [
        'categoria',
        'subcategoria',
        'especialidad',
        'estado',
        'ciudad',
        'sucursales',
      ],
      order: { id: 'ASC' },
    });
  }

  // ============================================================
  // CREAR NEGOCIO
  // ============================================================
  async crear(dto: CreateNegocioDto): Promise<Negocio> {
    // Obtener suscriptor
    const suscriptor = await this.suscriptorRepo.findOne({
      where: { id: dto.suscriptorId },
      relations: ['membresia'],
    });

    if (!suscriptor) {
      throw new NotFoundException('Suscriptor no encontrado');
    }

    // Contar negocios previos
    const totalNegocios = await this.negocioRepo.count({
      where: { suscriptor: { id: suscriptor.id }, eliminado: false },
    });

    // Límite por membresía
    const membresiaNombre = suscriptor.membresia?.nombre?.toLowerCase() || 'gratuita';
    const limite = LIMITE_NEGOCIOS_POR_MEMBRESIA[membresiaNombre] ?? 1;

    if (totalNegocios >= limite) {
      throw new BadRequestException(
        `Tu membresía (${suscriptor.membresia.nombre}) permite registrar hasta ${limite} negocio(s).`,
      );
    }

    const estadoInicial = ESTADOS_NEGOCIO.ACTIVA;

    // Crear negocio
    const nuevo = this.negocioRepo.create({
      ...dto,
      suscriptor: { id: suscriptor.id } as any,
      categoria: { id: dto.categoriaId } as any,
      subcategoria: dto.subcategoriaId ? ({ id: dto.subcategoriaId } as any) : undefined,
      especialidad: dto.especialidadId ? ({ id: dto.especialidadId } as any) : undefined,
      ciudad: { id: dto.ciudadId } as any,
      estado: { id: estadoInicial } as any,
      logoUrl: dto.logoUrl || null,
    });

    const guardado = await this.negocioRepo.save(nuevo);

    await this.suscriptorRepo.update(suscriptor.id, { tieneNegocios: true });

    const completo = await this.negocioRepo.findOne({
      where: { id: guardado.id },
      relations: [
        'suscriptor',
        'categoria',
        'subcategoria',
        'especialidad',
        'estado',
        'ciudad',
        'sucursales',
      ],
    });

    // AUTOAPRENDIZAJE
    await this.autoGenerateKeywords(completo);

    return completo;
  }

  // ============================================================
  // GUARDAR / REFORZAR KEYWORD
  // ============================================================
  async saveKeyword(
    tipo: 'categoria' | 'subcategoria' | 'especialidad',
    referenciaId: number,
    palabra: string,
    relevancia = 5,
  ) {
    const keywordNorm = this.normalize(palabra);

    let existente = await this.keywordRepo.findOne({
      where: { tipo, referenciaId, keyword: keywordNorm },
    });

    if (existente) {
      existente.relevancia = Math.min(15, existente.relevancia + 1);
      return this.keywordRepo.save(existente);
    }

    return this.keywordRepo.save({
      tipo,
      referenciaId,
      keyword: keywordNorm,
      relevancia,
      idioma: 'es',
    });
  }

  // ============================================================
  // VARIANTES ORTOGRÁFICAS
  // ============================================================
  generateMisspellings(word: string): string[] {
    if (!word || word.length < 4) return [];
    const variantes = new Set<string>();

    const comunes = {
      s: ['z'],
      z: ['s'],
      c: ['s'],
      k: ['c'],
      b: ['v'],
      v: ['b'],
    };

    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (comunes[char]) {
        comunes[char].forEach(rep => {
          variantes.add(word.substring(0, i) + rep + word.substring(i + 1));
        });
      }
    }

    variantes.add(word.slice(1));
    variantes.add(word.slice(0, -1));
    variantes.add(word + word[word.length - 1]);

    return [...variantes];
  }

  // ============================================================
  // AUTO-GENERADOR DE KEYWORDS
  // ============================================================
  async autoGenerateKeywords(negocio: Negocio) {
    const keywords: Array<{
      tipo: 'categoria' | 'subcategoria' | 'especialidad';
      id: number;
      palabra: string;
    }> = [];

    const nombreNorm = this.normalize(negocio.nombreNegocio || '');
    const partes = nombreNorm.split(' ');

    // 1. Palabras del nombre → subcategoría
    partes.forEach(p => {
      if (p.length > 2 && negocio.subcategoria?.id) {
        keywords.push({
          tipo: 'subcategoria',
          id: negocio.subcategoria.id,
          palabra: p,
        });
      }
    });

    // 2. Categoría
    if (negocio.categoria) {
      keywords.push({
        tipo: 'categoria',
        id: negocio.categoria.id,
        palabra: negocio.categoria.nombre,
      });
    }

    // 3. Subcategoría
    if (negocio.subcategoria) {
      keywords.push({
        tipo: 'subcategoria',
        id: negocio.subcategoria.id,
        palabra: negocio.subcategoria.nombre,
      });
    }

    // 4. Especialidad + variantes
    if (negocio.especialidad) {
      const espNorm = this.normalize(negocio.especialidad.nombre);

      keywords.push({
        tipo: 'especialidad',
        id: negocio.especialidad.id,
        palabra: espNorm,
      });

      const variantes = this.generateMisspellings(espNorm);
      variantes.forEach(v =>
        keywords.push({
          tipo: 'especialidad',
          id: negocio.especialidad.id,
          palabra: v,
        }),
      );
    }

    // 5. Guardar en DB
    for (const kw of keywords) {
      if (!kw.id) continue;
      await this.saveKeyword(kw.tipo, kw.id, kw.palabra);
    }

    console.log(`🧠 Autoaprendizaje completado para negocio: ${negocio.nombreNegocio}`);
  }

  // ============================================================
  // ACTUALIZAR NEGOCIO
  // ============================================================
  async actualizar(id: number, dto: UpdateNegocioDto): Promise<Negocio> {
    const negocio = await this.obtenerPorId(id);
    Object.assign(negocio, dto);
    return this.negocioRepo.save(negocio);
  }

  // ============================================================
  // ELIMINAR (SOFT DELETE)
  // ============================================================
  async eliminar(id: number): Promise<void> {
    const negocio = await this.obtenerPorId(id);
    negocio.eliminado = true;
    await this.negocioRepo.save(negocio);
  }

  // ============================================================
  // DETALLE
  // ============================================================
  async obtenerDetalle(id: number) {
    const negocio = await this.negocioRepo.findOne({
      where: { id, eliminado: false },
      relations: [
        "suscriptor",
        "categoria",
        "subcategoria",
        "especialidad",
        "estado",
        "ciudad",
        "sucursales",
        "sucursales.ciudad",
        "sucursales.estado",
      ],
    });

    if (!negocio) {
      throw new NotFoundException(`No se encontró el negocio con id ${id}`);
    }

    const resumen = {
      totalSucursales: negocio.sucursales?.length || 0,
      estado: negocio.estado?.nombre || "Desconocido",
      fechaRegistro: negocio.fechaRegistro,
      ultimaActualizacion: negocio.fechaActualizacion,
    };

    return { negocio, resumen };
  }
}
