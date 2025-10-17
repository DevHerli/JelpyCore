import { Injectable } from '@nestjs/common';

/**
 * 🧼 Use Case: Limpieza básica de texto.
 */
@Injectable()
export class SanitizerUseCase {
  execute(texto: string): string {
    if (!texto) return texto;

    // Remueve emojis y símbolos extraños
    let sanitized = texto.replace(
      /[^\p{L}\p{N}\p{P}\p{Z}]/gu,
      ''
    );

    // Limpia espacios y saltos de línea
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Normaliza acentos
    sanitized = sanitized.normalize('NFC');

    return sanitized;
  }
}
