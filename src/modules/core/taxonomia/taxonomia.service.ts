import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KeywordTaxonomia } from './entities/keyword-taxonomia.entity';

@Injectable()
export class TaxonomiaService {
  constructor(
    @InjectRepository(KeywordTaxonomia)
    private readonly keywordRepo: Repository<KeywordTaxonomia>,
  ) {}

  normalize(text: string) {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * AUTOAPRENDIZAJE:
   * Aprende palabras como "sushi", "pizza", "alitas", etc.
   */
  async registerSearchKeyword(
    palabra: string,
    categoriaId?: number,
    subcategoriaId?: number,
    especialidadId?: number,
  ) {
    const norm = this.normalize(palabra);

    // 1. Determinar tipo e ID de referencia
    let tipo: 'categoria' | 'subcategoria' | 'especialidad' | null = null;
    let referenciaId: number | null = null;

    if (especialidadId) {
      tipo = 'especialidad';
      referenciaId = especialidadId;
    } else if (subcategoriaId) {
      tipo = 'subcategoria';
      referenciaId = subcategoriaId;
    } else if (categoriaId) {
      tipo = 'categoria';
      referenciaId = categoriaId;
    } else {
      return; // No aplicar autoaprendizaje
    }

    // 2. Buscar si ya existe la keyword
    let registro = await this.keywordRepo.findOne({
      where: {
        tipo,
        referenciaId,  // ✔ CORRECTO
        keyword: norm,
      },
    });

    if (registro) {
      // 3. Incrementar relevancia
      registro.relevancia = Math.min(15, (registro.relevancia ?? 1) + 1);
      await this.keywordRepo.save(registro);
      return;
    }

    // 4. Crear nueva keyword
    await this.keywordRepo.save({
      tipo,
      referenciaId,  // ✔ CORRECTO
      keyword: norm,
      relevancia: 5,
      idioma: 'es',
    });
  }
}
