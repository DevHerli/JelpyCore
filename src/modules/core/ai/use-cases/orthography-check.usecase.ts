import { Injectable } from '@nestjs/common';

/**
 * Use Case: Corrección ortográfica básica.
 * Puede integrarse con un motor externo más adelante (p. ej. LanguageTool o IA).
 */
@Injectable()
export class OrthographyCheckUseCase {
  /**
   * Corrige errores ortográficos simples o duplicaciones.
   * @param texto Texto original
   * @returns Texto corregido
   */
  execute(texto: string): string {
    if (!texto) return texto;

    let corrected = texto.trim();

    // Correcciones comunes
    corrected = corrected
      .replace(/\bq\b/gi, 'que')
      .replace(/\bxq\b/gi, 'porque')
      .replace(/\bxk\b/gi, 'porque')
      .replace(/\btmb\b/gi, 'también')
      .replace(/\bk\b/gi, 'que');

    // Doble espacio
    corrected = corrected.replace(/\s{2,}/g, ' ');

    return corrected;
  }
}
