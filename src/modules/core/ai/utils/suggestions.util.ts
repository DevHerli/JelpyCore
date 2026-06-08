export class SugerenciasUtil {
  static generar(
    filtros: {
      categoriaId?: number | null;
      subcategoriaId?: number | null;
      categoriaHint?: string;
      subcategoriaHint?: string;
      caracteristica?: string | null;
      caracteristicaAliases?: string[];
    },
    items: any[],
    ciudad: string,
    yaUsadas: string[] = [],
  ): string[] {
    if (!items || items.length === 0) {
      return [
        '¿Quieres intentar con otra búsqueda?',
        '¿Quieres buscar en otra ciudad?',
      ];
    }

    const pool = this.sugerenciasSeguras(ciudad);

    return pool
      .filter((s) => !yaUsadas.includes(s))
      .slice(0, 2);
  }

  private static sugerenciasSeguras(ciudad: string): string[] {
    return [
      '¿Quieres ver el horario de alguno?',
      '¿Quieres ver la ubicación?',
      '¿Quieres buscar algo diferente?',
      `¿Quieres buscar otra opción en ${ciudad || 'tu ciudad'}?`,
      '¿Quieres ver más detalles de algún lugar?',
    ];
  }
}