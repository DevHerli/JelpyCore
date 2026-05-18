import { JELPY_SEMANTIC_CATEGORIES } from '../jelpy-assistant/constants/jelpy-semantic-categories';

/**
 * Calcula la distancia de Levenshtein entre dos cadenas.
 * Sin dependencias externas.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Dada una palabra de búsqueda, encuentra el alias más cercano
 * en el diccionario semántico.
 * Retorna null si la distancia mínima es mayor al umbral.
 */
export function sugerirCorreccion(
  palabraBuscada: string,
  umbral = 3,
): { sugerencia: string; distancia: number } | null {
  const normalizar = (s: string) =>
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const buscadaNorm = normalizar(palabraBuscada);

  // Solo buscar correcciones para palabras de 4+ caracteres
  if (buscadaNorm.length < 4) return null;

  let mejorDistancia = Infinity;
  let mejorAlias = '';

  for (const categoria of JELPY_SEMANTIC_CATEGORIES) {
    for (const alias of categoria.aliases) {
      const aliasNorm = normalizar(alias);
      // Solo comparar aliases de longitud similar (evitar comparaciones absurdas)
      if (Math.abs(aliasNorm.length - buscadaNorm.length) > 4) continue;
      // Solo aliases de 1 sola palabra para corrección ortográfica
      if (aliasNorm.includes(' ')) continue;

      const dist = levenshtein(buscadaNorm, aliasNorm);
      if (dist < mejorDistancia && dist > 0) {
        mejorDistancia = dist;
        mejorAlias = alias;
      }
    }
  }

  if (mejorDistancia <= umbral && mejorAlias) {
    return { sugerencia: mejorAlias, distancia: mejorDistancia };
  }

  return null;
}
