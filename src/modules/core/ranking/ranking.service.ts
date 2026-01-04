import { Injectable } from '@nestjs/common';

@Injectable()
export class RankingService {
  // Pesos del algoritmo
  private readonly PESOS = {
    popularidad: 0.20,
    rating: 0.25,
    cercania: 0.25,
    membresia: 0.15,
    categoria: 0.10,
    preferencias: 0.10,
    promociones: 0.15,
  };

  calcularScore(item: any, filtros: any, preferenciasUsuario: any[] = []) {
    const {
      likes_count = 0,
      rating_promedio = 0,
      distancia_km = 5,
      tipo_membresia = 'gratis',
      categoria_id,
      subcategoria_id,
      tiene_promociones = false,
    } = item;

    // ========================
    // Normalizaciones
    // ========================

    // Popularidad normalizada (likes)
    const popularidad = Math.min(likes_count / 50, 1);

    // Rating normalizado
    const rating = rating_promedio / 5;

    // Cercanía: 1 = muy cerca, 0 = muy lejos
    const cercania = distancia_km <= 1 ? 1 : (1 / distancia_km);

    // Membresía
    const niveles = { gratis: 0.2, cortesía: 0.4, deluxe: 0.7, premium: 1.0 };
    const membresia = niveles[tipo_membresia] ?? 0.2;

    // Coincidencia con categoría buscada
    const matchCategoria =
      filtros?.categoriaId === categoria_id ? 1 : 0.3;

    const matchSubcategoria =
      filtros?.subcategoriaId === subcategoria_id ? 1 : 0.4;

    const categoriaScore = Math.max(matchCategoria, matchSubcategoria);

    // Preferencias del usuario (si ha buscado esto antes)
    const preferencia = preferenciasUsuario.some(
      (p) =>
        p.categoriaId === categoria_id ||
        p.subcategoriaId === subcategoria_id
    )
      ? 1
      : 0;

    // Promociones
    const promocion = tiene_promociones ? 1 : 0;

    // ========================
    // Calculo final
    // ========================
    const score =
      this.PESOS.popularidad * popularidad +
      this.PESOS.rating * rating +
      this.PESOS.cercania * cercania +
      this.PESOS.membresia * membresia +
      this.PESOS.categoria * categoriaScore +
      this.PESOS.preferencias * preferencia +
      this.PESOS.promociones * promocion;

    return Number(score.toFixed(5));
  }
}
